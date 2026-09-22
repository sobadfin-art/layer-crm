import { useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { filterAccountsBySearch } from "../lib/clientSearch.js";

// Correctif 2026-09-22 (demande client — "Recherche client par nom
// commercial ET raison sociale... construis cette recherche comme un
// composant réutilisable, puisqu'elle doit être réutilisée telle quelle au
// point 3 [Agenda]") : sélecteur de client par recherche texte
// (name/nomCommercial/contact/pays, insensible casse+accents — cf.
// lib/clientSearch.js#filterAccountsBySearch, la même fonction qu'utilisent
// ClientsList.jsx et NewOrderQuickAccess.jsx), affichant les deux noms sur
// chaque résultat comme sur ces deux écrans. Utilisé par Agenda.jsx pour la
// création de RDV (client obligatoire) et de tâche (client optionnel, avec
// repli "Moi-même" via `allowNone`).
//
// Props :
//  - accounts : liste déjà chargée par l'appelant (pas de fetch ici — reste
//    un composant de présentation pur, cohérent avec le style du projet).
//  - value : accountId sélectionné (ou "" si aucun).
//  - onChange(accountId) : accountId === "" pour "aucun client" (allowNone).
//  - allowNone / noneLabel : autorise et libelle l'option "aucun client"
//    (ex. "Moi-même" pour une tâche personnelle) — absent par défaut, pour
//    un RDV qui exige toujours un client (cf. orders.js, un RDV sans
//    accountId est refusé côté serveur).
export default function ClientSearchPicker({ accounts, value, onChange, allowNone = false, noneLabel, placeholder }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => filterAccountsBySearch(accounts, search).slice(0, 20), [accounts, search]);
  const selected = accounts.find((a) => a.id === value);

  if (selected) {
    return (
      <div className="client-search-picker">
        <div className="account-row" style={{ cursor: "default" }}>
          <div className="account-name">{selected.name}</div>
          {selected.nomCommercial && <div className="account-nom-commercial">{selected.nomCommercial}</div>}
          {selected.storeName && <div className="account-nom-commercial">{selected.storeName}</div>}
          <button type="button" className="btn outline" onClick={() => onChange("")}>
            {t("clientSearchPicker.change")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-search-picker">
      <input
        placeholder={placeholder || t("clientSearchPicker.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {allowNone && (
        <div className="client-search-picker-option" onClick={() => onChange("")}>
          {noneLabel || t("clientSearchPicker.none")}
        </div>
      )}
      {search.trim() && (
        <div className="client-search-picker-results">
          {filtered.length === 0 && <p className="empty-state">{t("clientSearchPicker.empty")}</p>}
          {filtered.map((a) => (
            <div className="account-row" key={a.id} style={{ cursor: "pointer" }} onClick={() => onChange(a.id)}>
              <div className="account-name">{a.name}</div>
              {a.nomCommercial && <div className="account-nom-commercial">{a.nomCommercial}</div>}
              {a.storeName && <div className="account-nom-commercial">{a.storeName}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
