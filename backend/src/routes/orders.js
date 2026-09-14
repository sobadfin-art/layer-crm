import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { canAccessAccount } from "../lib/scope.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { resolveUnitPrice, computeOrderTotals } from "../lib/pricing.js";
import { loadActiveBusinessRules } from "../lib/businessRules.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";
import { notifyUser, notifyUsers, userIdsWithRoles } from "../lib/notifications.js";

export const ordersRouter = Router();

const ORDER_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR];

async function loadAccountWithCountry(accountId) {
  const { rows } = await query(
    `SELECT a.*, c.code AS country_code FROM accounts a
     JOIN countries c ON c.id = a.country_id WHERE a.id = $1`,
    [accountId]
  );
  return rows[0] || null;
}

async function canAccessOrder(user, order) {
  if (user.role === ROLES.FRONT_DESK || user.role === ROLES.DIRECTEUR) return true;
  if (user.role === ROLES.REPRESENTANT) return order.rep_id === user.id;
  if (user.role === ROLES.MASTER_REP) {
    if (order.rep_id === user.id) return true;
    const managed = await getManagedRepUserIds(user.id);
    return managed.includes(order.rep_id);
  }
  return false;
}

// GET /api/orders — scope par rôle (voir canAccessOrder) + filtres pour la file
// front desk (section "Lot 4" du plan : filtres, recherche).
ordersRouter.get("/", requireAuth, requireRole(...ORDER_ROLES), async (req, res) => {
  const clauses = [];
  const params = [];
  let i = 1;

  if (req.user.role === ROLES.REPRESENTANT) {
    clauses.push(`o.rep_id = $${i++}`);
    params.push(req.user.id);
  } else if (req.user.role === ROLES.MASTER_REP) {
    const managed = await getManagedRepUserIds(req.user.id);
    clauses.push(`o.rep_id = ANY($${i++}::uuid[])`);
    params.push([req.user.id, ...managed]);
  }

  if (req.query.status) {
    clauses.push(`o.status = $${i++}`);
    params.push(req.query.status);
  }
  if (req.query.accountId) {
    clauses.push(`o.account_id = $${i++}`);
    params.push(req.query.accountId);
  }
  if (req.query.search) {
    clauses.push(`a.name ILIKE $${i++}`);
    params.push(`%${req.query.search}%`);
  }
  if (req.query.dateFrom) {
    clauses.push(`o.created_at >= $${i++}`);
    params.push(req.query.dateFrom);
  }
  if (req.query.dateTo) {
    clauses.push(`o.created_at <= $${i++}`);
    params.push(req.query.dateTo);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // rep_first_name/rep_last_name + merchandise_total ajoutés pour l'écran front
  // desk (file de commandes) : le nom du rep et un montant sont nécessaires à
  // l'affichage d'une ligne de la file, sans avoir à recharger chaque commande
  // individuellement.
  const { rows } = await query(
    `SELECT o.*, a.name AS account_name, a.country_id,
            u.first_name AS rep_first_name, u.last_name AS rep_last_name,
            COALESCE(SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct, 0) / 100)), 0)::numeric(12,2) AS merchandise_total
     FROM orders o
     JOIN accounts a ON a.id = o.account_id
     JOIN users u ON u.id = o.rep_id
     LEFT JOIN order_lines ol ON ol.order_id = o.id
     ${where}
     GROUP BY o.id, a.name, a.country_id, u.first_name, u.last_name
     ORDER BY o.created_at DESC`,
    params
  );
  res.json(toCamelList(rows));
});

ordersRouter.get("/:id", requireAuth, requireRole(...ORDER_ROLES), async (req, res) => {
  const { rows } = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: "Commande introuvable." });
  if (!(await canAccessOrder(req.user, order))) {
    return res.status(403).json({ error: "Accès refusé à cette commande." });
  }

  const { rows: lines } = await query(
    `SELECT ol.*, p.ref, p.label, p.category FROM order_lines ol
     JOIN products p ON p.id = ol.product_id WHERE ol.order_id = $1`,
    [req.params.id]
  );

  res.json({ ...toCamel(order), lines: toCamelList(lines) });
});

const lineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  discountPct: z.number().min(0).max(100).optional(),
  isGift: z.boolean().optional(),
  isReliquat: z.boolean().optional(),
  reliquatShipDate: z.string().datetime().optional().nullable(),
});

const createSchema = z.object({
  accountId: z.string().uuid(),
  isPrecommande: z.boolean().optional(),
  desiredDeliveryDate: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
  shippingOffered: z.boolean().optional(), // bouton manuel "Offrir", indépendant du seuil
  lines: z.array(lineSchema).min(1),
});

// POST /api/orders — panier -> commande en brouillon, avec calcul serveur des
// prix/remises/frais de port (jamais fait confiance au client pour ces valeurs).
ordersRouter.post("/", requireAuth, requireRole(...ORDER_ROLES), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const account = await loadAccountWithCountry(data.accountId);
  if (!account) return res.status(400).json({ error: "Compte introuvable." });
  if (!canAccessAccount(req.user, account)) {
    return res.status(403).json({ error: "Accès refusé à ce compte." });
  }

  const productIds = data.lines.map((l) => l.productId);
  const { rows: products } = await query("SELECT * FROM products WHERE id = ANY($1::uuid[])", [
    productIds,
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of data.lines) {
    const product = productById.get(line.productId);
    if (!product) {
      return res.status(400).json({ error: `Produit introuvable : ${line.productId}` });
    }
    if (line.isReliquat && product.stock_status !== "REASSORT_PREVU") {
      return res.status(400).json({
        error: `${product.ref} n'est pas en "Réassort prévu" — impossible de le commander en reliquat.`,
      });
    }
  }

  const businessRules = await loadActiveBusinessRules();

  const linesForPricing = data.lines.map((line) => {
    const product = productById.get(line.productId);
    return {
      product,
      qty: line.qty,
      unitPriceHt: Number(resolveUnitPrice(product, account.country_code)) || 0,
      discountPct: line.discountPct,
      isGift: line.isGift ?? false,
      isReliquat: line.isReliquat ?? false,
      reliquatShipDate: line.reliquatShipDate ?? product.restock_date ?? null,
    };
  });

  const totals = computeOrderTotals({
    lines: linesForPricing,
    businessRules,
    repId: account.owner_rep_id,
    countryId: account.country_id,
  });

  const shippingOffered = Boolean(data.shippingOffered) || totals.shippingAutoOffered;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (account_id, rep_id, is_precommande, desired_delivery_date, note, shipping_fee_ht, shipping_offered)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        account.id,
        account.owner_rep_id, // la commande est toujours attribuée au rep propriétaire du compte
        data.isPrecommande ?? false,
        data.desiredDeliveryDate ?? null,
        data.note ?? null,
        totals.shippingFeeHt,
        shippingOffered,
      ]
    );
    const order = orderRows[0];

    for (const line of totals.lines) {
      await client.query(
        `INSERT INTO order_lines (order_id, product_id, qty, unit_price_ht, discount_pct, is_gift, is_reliquat, reliquat_ship_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          order.id,
          line.product.id,
          line.qty,
          line.unitPriceHt,
          line.discountPct,
          line.isGift,
          line.isReliquat,
          line.reliquatShipDate,
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...toCamel(order),
      totals: {
        totalQty: totals.totalQty,
        merchandiseAmount: totals.merchandiseAmount,
        shippingFeeHt: totals.shippingFeeHt,
        shippingOffered,
        orderTotal: shippingOffered ? totals.merchandiseAmount : totals.merchandiseAmount + totals.shippingFeeHt,
        byCategory: totals.byCategory,
      },
      lines: totals.lines.map((l) => ({
        productId: l.product.id,
        ref: l.product.ref,
        category: l.product.category,
        qty: l.qty,
        unitPriceHt: l.unitPriceHt,
        discountPct: l.discountPct,
        isGift: l.isGift,
        isReliquat: l.isReliquat,
        lineTotal: l.lineTotal,
      })),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/status — validation front desk avant export Dolibarr
// (section 4 cahier des charges : "à valider manuellement par le front desk après
// import"). Seuls front desk et directeur valident/annulent (le représentant a
// déjà fait sa part en envoyant la commande).
const STATUS_TRANSITIONS = {
  ENVOYEE_FRONT_DESK: ["VALIDEE", "ANNULEE"],
  VALIDEE: ["ANNULEE"],
};

ordersRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole(ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const schema = z.object({ status: z.enum(["VALIDEE", "ANNULEE"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Statut invalide." });

    const { rows } = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Commande introuvable." });

    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(parsed.data.status)) {
      return res.status(409).json({
        error: `Transition ${order.status} -> ${parsed.data.status} non autorisée.`,
      });
    }

    // validated_at n'est écrit qu'à cette transition précise (ENVOYEE_FRONT_DESK
    // -> VALIDEE), jamais ré-écrit ensuite — règle définitive : c'est la seule
    // date de référence pour la période d'un objectif (cf. lib/objectiveProgress.js),
    // jamais created_at ni updated_at (qui bougent pour d'autres raisons, ex.
    // une annulation ultérieure ne doit pas effacer le fait que la commande a
    // été validée à un instant donné).
    const becomingValidated = parsed.data.status === "VALIDEE" && order.status !== "VALIDEE";
    const { rows: updated } = await query(
      becomingValidated
        ? `UPDATE orders SET status = $1, validated_at = now(), updated_at = now() WHERE id = $2 RETURNING *`
        : `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [parsed.data.status, req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: parsed.data.status === "VALIDEE" ? "ORDER_VALIDATED" : "ORDER_CANCELLED",
      entity: "orders",
      entityId: order.id,
      details: { from: order.status, to: parsed.data.status },
    });

    await notifyUser({
      userId: order.rep_id,
      type: parsed.data.status === "VALIDEE" ? "ORDER_VALIDATED" : "ORDER_CANCELLED",
      title: parsed.data.status === "VALIDEE" ? "Commande validée" : "Commande annulée",
      body:
        parsed.data.status === "VALIDEE"
          ? "Votre commande a été validée par le front desk."
          : "Votre commande a été annulée par le front desk.",
      entity: "orders",
      entityId: order.id,
    });

    res.json(toCamel(updated[0]));
  }
);

// PATCH /api/orders/:id/confirm-delivery — bascule précommande -> CA ferme.
// Action distincte de la validation front desk (PATCH /:id/status) : une
// commande de précommande passe d'abord par la validation habituelle
// (ENVOYEE_FRONT_DESK -> VALIDEE), PUIS, plus tard, par cette confirmation de
// livraison qui la fait compter comme CA ferme (cf. computeObjectiveProgress
// et /api/dashboard/analytics). Règle confirmée : jamais de bascule
// automatique par la seule desired_delivery_date dépassée — c'est toujours un
// humain (front desk/directeur) qui confirme que la marchandise est réellement
// partie.
ordersRouter.patch(
  "/:id/confirm-delivery",
  requireAuth,
  requireRole(ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const { rows } = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Commande introuvable." });

    if (!order.is_precommande) {
      return res.status(409).json({ error: "Cette commande n'est pas une précommande." });
    }
    if (order.converted_to_firm) {
      return res.status(409).json({ error: "Livraison déjà confirmée pour cette commande." });
    }
    if (!["VALIDEE", "EXPORTEE_DOLIBARR"].includes(order.status)) {
      return res.status(409).json({
        error: "La commande doit d'abord être validée par le front desk avant de confirmer la livraison.",
      });
    }

    const { rows: updated } = await query(
      `UPDATE orders SET converted_to_firm = TRUE, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "ORDER_DELIVERY_CONFIRMED",
      entity: "orders",
      entityId: order.id,
      details: { accountId: order.account_id },
    });

    await notifyUser({
      userId: order.rep_id,
      type: "ORDER_DELIVERY_CONFIRMED",
      title: "Livraison confirmée",
      body: "Votre précommande est passée en chiffre d'affaires ferme.",
      entity: "orders",
      entityId: order.id,
    });

    res.json(toCamel(updated[0]));
  }
);

// POST /api/orders/:id/send-to-front-desk — section 6/Lot 3 : "envoi au front desk + notification".
// La notification temps réel (push/websocket) est désormais branchée (Lot 6, lib/notifications.js) :
// tous les front desk + le directeur reçoivent une notification à l'envoi d'une commande.
ordersRouter.post(
  "/:id/send-to-front-desk",
  requireAuth,
  requireRole(...ORDER_ROLES),
  async (req, res) => {
    const { rows } = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Commande introuvable." });
    if (!(await canAccessOrder(req.user, order))) {
      return res.status(403).json({ error: "Accès refusé à cette commande." });
    }
    if (order.status !== "BROUILLON") {
      return res.status(409).json({ error: `Commande déjà au statut ${order.status}.` });
    }

    const { rows: updated } = await query(
      `UPDATE orders SET status = 'ENVOYEE_FRONT_DESK', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "ORDER_SENT_TO_FRONT_DESK",
      entity: "orders",
      entityId: order.id,
      details: { accountId: order.account_id },
    });

    const recipients = await userIdsWithRoles([ROLES.FRONT_DESK, ROLES.DIRECTEUR]);
    await notifyUsers(recipients, {
      type: "ORDER_SENT_TO_FRONT_DESK",
      title: "Nouvelle commande à valider",
      body: `Une commande a été envoyée au front desk.`,
      entity: "orders",
      entityId: order.id,
    });

    res.json(toCamel(updated[0]));
  }
);
