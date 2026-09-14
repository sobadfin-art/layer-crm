// Bandeau "hors ligne" (Lot 6 — PWA / mode hors-ligne partiel). Le mode
// hors-ligne partiel lui-même est assuré par le service worker (public/sw.js,
// cache-first sur l'app shell + dernières données JSON vues) : ce composant
// ne fait qu'informer l'utilisateur qu'il consulte des données potentiellement
// périmées et que les actions d'écriture ne fonctionneront pas tant que la
// connexion n'est pas revenue.
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return <div className="offline-banner">{t("offline.banner")}</div>;
}
