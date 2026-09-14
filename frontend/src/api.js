// Petit client HTTP central.
//
// Migration "cookie only" (chantier durcissement auth) : le JWT n'est plus
// dupliqué entre le cookie httpOnly posé par le backend et le localStorage.
// On s'appuie exclusivement sur le cookie httpOnly "token", envoyé
// automatiquement par le navigateur grâce à `credentials: "include"` — plus
// besoin de le lire ni de poser de header Authorization côté JS (et de toute
// façon impossible : httpOnly empêche justement le JS d'y accéder, ce qui
// protège le token contre un vol par XSS).
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { ...options, headers, credentials: "include" });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.blob();

  if (!res.ok) {
    const message = isJson && data && data.error ? formatError(data.error) : `Erreur ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.code = isJson && data ? data.code : undefined;
    err.data = data;
    throw err;
  }
  return data;
}

function formatError(error) {
  if (typeof error === "string") return error;
  if (error && error.fieldErrors) {
    return Object.values(error.fieldErrors).flat().join(" ") || "Requête invalide.";
  }
  return "Requête invalide.";
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: (path) => request(path, { method: "DELETE" }),
};
