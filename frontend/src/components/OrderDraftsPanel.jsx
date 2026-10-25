import { FileClock } from "lucide-react";
import { dateTime } from "../lib/format.js";
import { draftLineCount } from "../lib/orderDrafts.js";

// Liste des brouillons de commande locaux (point 8) — partagée entre l'écran
// de prise de commande (NewOrder.jsx) et la modale d'accès rapide
// (NewOrderQuickAccess.jsx). "Supprimer" demande confirmation dès que le
// brouillon contient des lignes ; un brouillon sans ligne (ex. seulement une
// note) est supprimé directement.
export default function OrderDraftsPanel({ drafts, onResume, onDelete, t, locale }) {
  if (!drafts || drafts.length === 0) return null;

  function handleDelete(draft) {
    const count = draftLineCount(draft);
    if (count > 0 && !window.confirm(t("orderDrafts.deleteConfirm", { name: draft.accountName, count }))) return;
    onDelete(draft);
  }

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}>
        <FileClock size={16} /> {t("orderDrafts.title")}
      </h3>
      <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 0 }}>{t("orderDrafts.hint")}</p>
      {drafts.map((d) => (
        <div className="account-row" key={d.draftId} style={{ gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="account-name">{d.accountName}</div>
            <div className="account-meta">
              {t("orderDrafts.updatedAt", { date: dateTime(d.updatedAt, locale) })} ·{" "}
              {t("orderDrafts.lineCount", { count: draftLineCount(d) })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn primary" onClick={() => onResume(d)}>
              {t("orderDrafts.resume")}
            </button>
            <button type="button" className="btn outline" onClick={() => handleDelete(d)}>
              {t("orderDrafts.delete")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
