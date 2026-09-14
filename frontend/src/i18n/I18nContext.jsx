import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { LOCALES, translations } from "./translations.js";

const I18nContext = createContext(null);

const STORAGE_KEY = "moken_locale";

function detectDefaultLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored)) return stored;
  } catch {
    // localStorage indisponible (navigation privée, etc.) — repli silencieux.
  }
  const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
  return LOCALES.includes(nav) ? nav : "fr";
}

function resolve(dict, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : `{${key}}`));
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectDefaultLocale);

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Pas grave si on ne peut pas persister — juste pas de mémorisation
      // entre deux sessions dans ce navigateur.
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = translations[locale] || translations.fr;
      const value = resolve(dict, key);
      if (value === undefined) {
        // Repli sur le français plutôt qu'une clé brute affichée à l'écran —
        // et log en console pour repérer les clés manquantes en dev.
        const fallback = resolve(translations.fr, key);
        if (fallback === undefined) {
          console.warn(`[i18n] Clé de traduction manquante : ${key}`);
          return key;
        }
        return interpolate(fallback, vars);
      }
      return interpolate(value, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé sous I18nProvider.");
  return ctx;
}
