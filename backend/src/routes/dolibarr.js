import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import {
  getDolibarrSettings,
  buildExportChecklist,
  buildDolibarrXlsx,
  loadOrderBundle,
} from "../lib/dolibarrExport.js";
import { toCamel } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const dolibarrRouter = Router();

// Front desk + directeur : ce sont eux qui opèrent l'export au quotidien
// (section 3 : "vérifie et exporte vers Dolibarr" pour le front desk ;
// le directeur a un accès direct à la vue front desk).
const EXPORT_ROLES = [ROLES.FRONT_DESK, ROLES.DIRECTEUR];

dolibarrRouter.get("/settings", requireAuth, requireRole(...EXPORT_ROLES), async (req, res) => {
  res.json(toCamel(await getDolibarrSettings()));
});

// TVA retirée du périmètre (le CRM ne gère pas de taux de TVA — confirmé) ;
// conditions/mode de règlement portent désormais de vraies valeurs métier
// (payment_term_days = 30 jours par défaut, payment_mode = SEPA ou LCR
// uniquement) modifiables seulement par front desk/directeur (déjà le cas :
// ces réglages entiers leur sont réservés). Les ID internes Dolibarr restent
// configurables en complément, pour plus tard, mais ne sont plus obligatoires.
const settingsSchema = z.object({
  productMatchField: z.enum(["ref", "rowid"]).optional(),
  accountMatchField: z.enum(["code_client", "siret_vat", "name"]).optional(),
  giftLineStrategy: z.enum(["ZERO_PRICE", "FULL_DISCOUNT"]).optional(),
  defaultOrderStatus: z.enum(["BROUILLON", "VALIDEE", "A_VALIDER"]).optional(),
  defaultWarehouseId: z.string().optional().nullable(),
  paymentTermDays: z.number().int().positive().optional(),
  paymentMode: z.enum(["PRELEVEMENT_SEPA", "LCR"]).optional(),
  defaultPaymentTermId: z.string().optional().nullable(),
  defaultPaymentModeId: z.string().optional().nullable(),
  csvDelimiter: z.string().min(1).max(1).optional(),
  // TVA — dérivée du regime_fiscal de chaque compte (migration 007), pas d'un
  // taux unique global. Base non définitive, à valider par l'expert-comptable.
  vatRateFranceStandard: z.number().min(0).max(100).optional(),
  vatRateRecargoEquivalencia: z.number().min(0).max(100).optional().nullable(),
});

const COLUMN_FOR = {
  productMatchField: "product_match_field",
  accountMatchField: "account_match_field",
  giftLineStrategy: "gift_line_strategy",
  defaultOrderStatus: "default_order_status",
  defaultWarehouseId: "default_warehouse_id",
  paymentTermDays: "payment_term_days",
  paymentMode: "payment_mode",
  defaultPaymentTermId: "default_payment_term_id",
  defaultPaymentModeId: "default_payment_mode_id",
  csvDelimiter: "csv_delimiter",
  vatRateFranceStandard: "vat_rate_france_standard",
  vatRateRecargoEquivalencia: "vat_rate_recargo_equivalencia",
};

dolibarrRouter.patch("/settings", requireAuth, requireRole(...EXPORT_ROLES), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sets = [];
  const params = [];
  let i = 1;
  for (const [field, value] of Object.entries(parsed.data)) {
    sets.push(`${COLUMN_FOR[field]} = $${i++}`);
    params.push(value);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  sets.push("updated_at = now()");

  const { rows } = await query(
    `UPDATE dolibarr_settings SET ${sets.join(", ")} WHERE id = 'default' RETURNING *`,
    params
  );

  await logAudit({
    userId: req.user.id,
    action: "DOLIBARR_SETTINGS_UPDATED",
    entity: "dolibarr_settings",
    entityId: "default",
    details: { fields: Object.keys(parsed.data) },
  });

  res.json(toCamel(rows[0]));
});

dolibarrRouter.get(
  "/orders/:id/export-checklist",
  requireAuth,
  requireRole(...EXPORT_ROLES),
  async (req, res) => {
    const checklist = await buildExportChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Commande introuvable." });
    res.json(checklist);
  }
);

const exportSchema = z.object({ orderIds: z.array(z.string().uuid()).min(1) });

dolibarrRouter.post("/orders/export", requireAuth, requireRole(...EXPORT_ROLES), async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "orderIds requis." });

  const settings = await getDolibarrSettings();
  const bundles = [];
  const rejected = [];

  for (const orderId of parsed.data.orderIds) {
    const checklist = await buildExportChecklist(orderId);
    if (!checklist) {
      rejected.push({ orderId, reason: "Commande introuvable." });
      continue;
    }
    if (!checklist.canExport) {
      rejected.push({ orderId, reason: checklist.blockingIssues.join(" ; ") });
      continue;
    }
    bundles.push(await loadOrderBundle(orderId));
  }

  if (bundles.length === 0) {
    return res.status(422).json({ error: "Aucune commande exportable.", rejected });
  }

  // Fichier .xlsx — bascule demandée par la fiche corrective V2 Front Desk
  // (section 2 : "Fichier Dolibarr (.xlsx)"), confirmée par vous en
  // remplacement du CSV d'origine (Lot 4, cf. README). buildDolibarrCsv reste
  // disponible dans lib/dolibarrExport.js pour un usage outillage éventuel,
  // mais ce n'est plus ce que télécharge le front desk.
  const xlsx = buildDolibarrXlsx(bundles, settings);

  // Marquage + traçabilité, seulement pour les commandes réellement exportées.
  for (const order of bundles) {
    const refClient = order.dolibarr_ref_client || `O-${order.id.slice(0, 8)}`;
    await query(
      `UPDATE orders SET status = 'EXPORTEE_DOLIBARR', exported_at = now(), dolibarr_ref_client = $1, updated_at = now()
       WHERE id = $2`,
      [refClient, order.id]
    );
    await logAudit({
      userId: req.user.id,
      action: "ORDER_EXPORTED_DOLIBARR",
      entity: "orders",
      entityId: order.id,
      details: { refClient },
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="export-dolibarr-${Date.now()}.xlsx"`);
  if (rejected.length > 0) {
    res.setHeader("X-Export-Rejected", JSON.stringify(rejected));
  }
  res.send(xlsx);
});
