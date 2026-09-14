// Service worker — PWA / mode hors-ligne partiel (Lot 6).
//
// Portée volontairement limitée et honnête, cohérente avec le README :
//   - App shell (JS/CSS/HTML/police) : cache-first avec repli réseau, pour un
//     démarrage instantané et un minimum de fonctionnement hors-ligne (l'appli
//     se charge, même sans réseau).
//   - Quelques lectures GET précises côté API (liste des commandes front desk,
//     détail d'une commande, notifications) : réseau en priorité, mais on
//     garde une copie en cache pour pouvoir au moins AFFICHER la dernière
//     donnée connue si la requête réseau échoue — jamais pour écrire.
//   - Tout le reste (POST/PATCH/DELETE, et les endpoints non listés) n'est
//     jamais intercepté : ça doit échouer normalement hors-ligne, pas
//     silencieusement "réussir" avec une réponse en cache périmée. C'est du
//     lecture-seule hors-ligne, jamais de fausse impression d'écriture qui
//     aurait fonctionné.
const CACHE_NAME = "moken-crm-v1";

// Endpoints GET dont on accepte de servir une réponse en cache si le réseau
// échoue — seulement des lectures sans effet de bord, jamais un endpoint qui
// pourrait laisser croire qu'une action a réussi.
const OFFLINE_READABLE_API_PATTERNS = [/^\/api\/orders(\/[^/]+)?$/, /^\/api\/notifications$/];

// Précache le strict minimum nécessaire pour qu'un rechargement complet
// fonctionne hors-ligne : le document HTML lui-même (dont le nom ne change
// jamais, contrairement aux fichiers JS/CSS buildés qui portent un hash — ceux-
// là sont mis en cache dynamiquement à la première visite via
// cacheFirstWithNetwork). Sans ce précache, la toute première navigation vers
// "/" n'a jamais transité par ce service worker (il ne prend le contrôle
// qu'après son activation) et ne serait donc jamais en cache pour un
// rechargement hors-ligne ultérieur.
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn("Précache app shell partiellement échoué :", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isOfflineReadableApi(pathname) {
  return OFFLINE_READABLE_API_PATTERNS.some((re) => re.test(pathname));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Jamais intercepter une écriture, ni le websocket de notifications
  // temps réel : ces requêtes doivent échouer normalement hors-ligne.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname === "/ws" || url.protocol === "ws:" || url.protocol === "wss:") return;

  if (url.pathname.startsWith("/api/")) {
    if (!isOfflineReadableApi(url.pathname)) return; // laisse passer sans interception
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  event.respondWith(cacheFirstWithNetwork(request));
});

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Stale-while-revalidate : on sert le cache tout de suite, et on
    // rafraîchit en tâche de fond pour la prochaine visite.
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
