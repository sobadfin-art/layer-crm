import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Parcours C — "Accès rapide depuis le dashboard" (fiche corrective Parcours
// de création de commande, 2026-09-16) : bouton "Nouvelle commande" visible
// en haut à droite du dashboard, qui exige TOUJOURS une sélection de client
// existant avant d'ouvrir le catalogue ("ne doit jamais permettre de créer
// une commande sans client rattaché"). Partagé entre le Dashboard
// Représentant et le Dashboard Directeur (fiche corrective Direction
// Commerciale V3) — jamais le Master Rep, qui reste en lecture seule.
//
// GET /accounts est déjà scopé par rôle côté serveur (ses propres comptes
// pour un représentant, tous les comptes pour un directeur) : aucun filtrage
// de portée supplémentaire à faire ici, seulement la recherche texte libre.
export default function NewOrderQuickAccess() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  function openPicker() {
    setOpen(true);
    setSearch("");
    setError(null);
    setLoading(true);
    api
      .get("/accounts")
      .then(setAccounts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => [a.name, a.contactName, a.countryName].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [accounts, search]);

  function pick(account) {
    setOpen(false);
    navigate(`/clients/${account.id}/commande`);
  }

  return (
    <>
      <button className="btn primary" onClick={openPicker} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Plus size={15} /> {t("newOrderQuickAccess.button")}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t("newOrderQuickAccess.title")}</h3>
            <p className="page-sub" style={{ marginTop: 0 }}>
              {t("newOrderQuickAccess.subtitle")}
            </p>
            <div className="search-bar">
              <Search size={15} color="#8892a0" />
              <input
                autoFocus
                placeholder={t("newOrderQuickAccess.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {loading && <p className="empty-state">{t("newOrderQuickAccess.loading")}</p>}
            {error && <p className="error-text">{error}</p>}
            {!loading && !error && filtered.length === 0 && <p className="empty-state">{t("newOrderQuickAccess.empty")}</p>}
            {!loading && !error && (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {filtered.map((a) => (
                  <div className="account-row" key={a.id} style={{ cursor: "pointer" }} onClick={() => pick(a)}>
                    <div>
                      <div className="account-name">{a.name}</div>
                      <div className="account-meta">{a.countryName || t("newOrderQuickAccess.noCountry")}</div>
                    </div>
                    <span className="typology-badge">{t(a.type === "CLIENT" ? "account.client" : "account.prospect")}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn outline" onClick={() => setOpen(false)}>
                {t("teamManagement.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
