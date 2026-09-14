import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

// Mode hors-ligne partiel (Lot 6) : on garde une copie du dernier profil
// utilisateur connu, pour pouvoir rouvrir l'appli hors-ligne sans repasser
// par l'écran de connexion (qui de toute façon échouerait sans réseau).
const USER_CACHE_KEY = "moken_user_cache";

function loadCachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheUser(user) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Pas grave si le cache utilisateur n'est pas dispo (navigation privée,
    // quota plein...) — juste pas de fonctionnement hors-ligne dans ce cas.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offlineSession, setOfflineSession] = useState(false);

  // Migration "cookie only" (chantier durcissement auth) : on ne peut plus
  // savoir depuis le JS si un cookie httpOnly est présent (c'est tout l'intérêt
  // de httpOnly). On tente donc systématiquement /auth/me au montage — le
  // navigateur envoie le cookie automatiquement s'il existe, sinon le serveur
  // répond 401 et on reste simplement déconnecté. Plus de "gate" sur un token
  // lisible en JS.
  useEffect(() => {
    api
      .get("/auth/me")
      .then((u) => {
        setUser(u);
        cacheUser(u);
        setOfflineSession(false);
      })
      .catch((err) => {
        // Une coupure réseau (err.status absent, car fetch() lui-même a
        // échoué avant même d'atteindre le serveur) ne doit JAMAIS
        // déconnecter l'utilisateur — seul un vrai rejet par le serveur (401,
        // pas de session ; 403 ACCOUNT_DEACTIVATED, compte désactivé) le doit.
        // Sans cette distinction, recharger la page hors-ligne effaçait la
        // session locale et renvoyait sur l'écran de connexion, rendant le
        // service worker/cache localStorage inutiles en pratique.
        if (err.status === 401 || err.code === "ACCOUNT_DEACTIVATED") {
          cacheUser(null);
          setUser(null);
          return;
        }
        const cached = loadCachedUser();
        if (cached) {
          setUser(cached);
          setOfflineSession(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    setUser(data.user);
    cacheUser(data.user);
    setOfflineSession(false);
  }

  function logout() {
    setUser(null);
    cacheUser(null);
    // Le backend efface le cookie httpOnly ; on nettoie aussi tout état
    // frontend pour que l'UI ne traite jamais l'utilisateur comme encore
    // connecté, même si l'appel réseau échoue.
    api.post("/auth/logout").catch(() => {});
  }

  // Après un changement de mot de passe réussi (forcé en première connexion,
  // ou volontaire), on n'a plus besoin de recharger tout /auth/me : on sait
  // localement que la contrainte est levée.
  function clearMustChangePassword() {
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, offlineSession, clearMustChangePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
