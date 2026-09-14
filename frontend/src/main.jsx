import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);

// PWA — enregistrement du service worker (Lot 6, cf. public/sw.js et
// public/manifest.json). Fonctionne aussi bien en `vite dev` (public/ est
// servi tel quel) qu'après `vite build`. Le catch() est volontaire : un échec
// d'enregistrement (navigateur sans support, contexte non https en prod...)
// ne doit jamais empêcher l'application de fonctionner normalement en ligne.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker non enregistré (non bloquant) :", err.message);
    });
  });
}
