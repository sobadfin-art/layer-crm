import { useEffect, useState } from "react";
import { MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Écran Administrateur — Géocodage rétroactif (2026-09-23, suite au
// correctif "vraie carte interactive Mapbox GL JS" : "je n'ai pas pu me
// connecter à Shell sans upgrade de plan"). Le plan Render du client
// n'inclut pas l'accès Shell, seul moyen prévu initialement pour lancer
// `npm run geocode-accounts` (toujours disponible en ligne de commande pour
// un environnement qui, lui, a le Shell — cf. ce script). Cet écran obtient
// le même résultat depuis le navigateur : il boucle sur
// `POST /api/accounts/geocode-retroactive?limit=15` jusqu'à ce qu'il n'y ait
// plus aucune fiche sans coordonnées, en cumulant un résumé au fil de l'eau
// — même principe que l'écran "Import photos en masse" (traitement par lots
// avec statut visible plutôt qu'un seul appel réseau qui dépasserait le
// délai d'expiration d'une requête HTTP vu la limite d'1 requête Nominatim/
// seconde, cf. lib/geocoding.js côté serveur).
const BATCH_LIMIT = 15;

export default function GeocodeRetroactive() {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ converted: 0, failedNoAddress: 0, failedNotFound: 0 });
  const [details, setDetails] = useState([]);
  const [done, setDone] = useState(0);

  // Nombre de fiches à traiter, connu dès l'arrivée sur l'écran — une simple
  // lecture (GET .../count), jamais de géocodage déclenché juste en
  // affichant la page.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/accounts/geocode-retroactive/count`)
      .then((data) => {
        if (!cancelled) setRemaining(data.remaining);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingCount(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function runBatch() {
    setError(null);
    const data = await api.post(`/accounts/geocode-retroactive?limit=${BATCH_LIMIT}`);
    setDone((d) => d + data.processed);
    setSummary((s) => ({
      converted: s.converted + data.converted,
      failedNoAddress: s.failedNoAddress + data.failedNoAddress,
      failedNotFound: s.failedNotFound + data.failedNotFound,
    }));
    setDetails((prev) => [...prev, ...data.details]);
    setRemaining(data.remaining);
    return data.remaining;
  }

  async function start() {
    setRunning(true);
    setError(null);
    try {
      let left = remaining;
      // Boucle jusqu'à épuisement — chaque lot traite jusqu'à BATCH_LIMIT
      // fiches (~15-20s avec le throttle 1 req/s), donc plusieurs allers-
      // retours réseau plutôt qu'un seul appel bloquant trop longtemps.
      while (left > 0) {
        left = await runBatch();
      }
    } catch (err) {
      setError(err.message || t("geocodeRetroactive.error"));
    } finally {
      setRunning(false);
    }
  }

  const totalAttempted = summary.converted + summary.failedNoAddress + summary.failedNotFound;

  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <h3>
        <MapPin size={14} /> {t("geocodeRetroactive.title")}
      </h3>
      <p className="page-sub" style={{ marginTop: -6 }}>{t("geocodeRetroactive.subtitle")}</p>

      {loadingCount && <p className="empty-state">{t("geocodeRetroactive.loadingCount")}</p>}

      {!loadingCount && (
        <>
          {remaining > 0 ? (
            <p style={{ margin: "10px 0" }}>{t("geocodeRetroactive.remainingCount", { count: remaining })}</p>
          ) : (
            <p className="empty-state">{t("geocodeRetroactive.allDone")}</p>
          )}

          {remaining > 0 && (
            <button type="button" className="btn primary" onClick={start} disabled={running}>
              {running ? (
                <>
                  <Loader2 size={14} className="spin" /> {t("geocodeRetroactive.runningButton")}
                </>
              ) : (
                t("geocodeRetroactive.startButton")
              )}
            </button>
          )}

          {running && (
            <p className="page-sub" style={{ marginTop: 10 }}>
              {t("geocodeRetroactive.progress", { done, remaining })}
            </p>
          )}

          {error && <p className="error-text">{error}</p>}

          {totalAttempted > 0 && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ marginBottom: 8 }}>{t("geocodeRetroactive.summaryTitle")}</h4>
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
                <CheckCircle2 size={14} color="var(--teal)" /> {t("geocodeRetroactive.converted")} : {summary.converted}
              </p>
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
                <XCircle size={14} color="var(--ink-soft)" /> {t("geocodeRetroactive.failedNoAddress")} : {summary.failedNoAddress}
              </p>
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
                <XCircle size={14} color="var(--ink-soft)" /> {t("geocodeRetroactive.failedNotFound")} : {summary.failedNotFound}
              </p>

              {details.some((d) => d.status !== "converted") && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12.5 }}>
                    {t("geocodeRetroactive.detailsTitle")}
                  </summary>
                  <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 6 }}>
                    {details
                      .filter((d) => d.status !== "converted")
                      .map((d, i) => (
                        <div key={i} className="account-row" style={{ cursor: "default" }}>
                          <div>
                            <div className="account-name">{d.name}</div>
                            <div className="account-meta">{d.reason}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
