import "dotenv/config";
// Patch Express pour que les erreurs levées dans un handler async (ex: une
// requête SQL en échec) tombent dans le middleware d'erreur au lieu de rester
// une promesse rejetée non gérée qui plante tout le process Node — trouvé en
// testant le Lot 5, corrigé pour l'ensemble de l'API plutôt qu'un seul endroit.
import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { parseCookie } from "cookie";
import { WebSocketServer } from "ws";
import { registerSocket, unregisterSocket } from "./lib/notifications.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/protected-demo.js";
import { accountsRouter } from "./routes/accounts.js";
import { interactionsRouter } from "./routes/interactions.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { tasksRouter } from "./routes/tasks.js";
import { catalogsRouter } from "./routes/catalogs.js";
import { productsRouter } from "./routes/products.js";
import { catalogImportRouter } from "./routes/catalog-import.js";
import { accountsImportRouter } from "./routes/accounts-import.js";
import { businessRulesRouter } from "./routes/business-rules.js";
import { ordersRouter } from "./routes/orders.js";
import { dolibarrRouter } from "./routes/dolibarr.js";
import { savRouter } from "./routes/sav.js";
import { usersRouter } from "./routes/users.js";
import { objectivesRouter } from "./routes/objectives.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { teamRouter } from "./routes/team.js";
import { auditLogsRouter } from "./routes/audit-logs.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminUsersRouter } from "./routes/admin-users.js";
import { countriesRouter } from "./routes/countries.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Sert les photos produit téléversées directement (cf. routes/products.js,
// POST /:id/photo) — alternative à une URL externe pour un produit pas
// encore en vente sur mokenvision.com. Lecture seule, pas d'exécution.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", meRouter); // routes de démonstration du cloisonnement par rôle (Lot 1)
app.use("/api/accounts", accountsRouter);
app.use("/api/accounts/:accountId/interactions", interactionsRouter);
app.use("/api/accounts/:accountId/attachments", attachmentsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/catalogs", catalogsRouter);
app.use("/api/catalogs/:catalogId/import", catalogImportRouter);
app.use("/api/accounts-import", accountsImportRouter);
app.use("/api/products", productsRouter);
app.use("/api/business-rules", businessRulesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/dolibarr", dolibarrRouter);
app.use("/api/sav", savRouter);
app.use("/api/users", usersRouter);
app.use("/api/objectives", objectivesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/team", teamRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/countries", countriesRouter);

// Sert le frontend buildé (frontend/dist) — utilisé en déploiement (ex. Render,
// une seule origine pour l'API et le frontend, ce qui évite tout problème de
// cookie cross-origin puisque la session repose sur un cookie httpOnly). Le
// build n'existe qu'après `cd frontend && npm run build` ; en développement
// local ce dossier n'existe pas, c'est `vite dev` qui sert le frontend
// séparément sur :5173 avec son propre proxy /api — ce bloc reste alors
// inactif, aucun changement au comportement local existant.
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Catch-all pour le routage côté client (react-router) — jamais pour /api
  // ni /uploads, qui doivent continuer à tomber sur le 404 JSON ci-dessous
  // s'ils ne correspondent à aucune route connue.
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "Route inconnue." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

// Serveur HTTP explicite (plutôt qu'app.listen direct) pour pouvoir y
// attacher le websocket de notifications temps réel (Lot 6) sur le même port,
// sans second process/port à gérer côté déploiement.
const server = http.createServer(app);

// Websocket de notifications — authentifié par le même JWT que le reste de
// l'API. Lu depuis le cookie httpOnly "token" présent dans les headers de la
// requête d'upgrade websocket : un navigateur envoie automatiquement les
// cookies du domaine sur une connexion websocket (ce n'est pas du JS qui les
// pose, donc httpOnly n'empêche pas cet envoi), ce qui évite d'avoir à faire
// transiter le JWT en clair dans l'URL (`?token=...`, visible dans les logs
// serveur/proxy) — cohérent avec la migration "cookie only" du reste de l'API.
// On garde un repli sur `?token=` uniquement pour un client non-navigateur qui
// ne pourrait pas poser de cookie (aucun cas d'usage actuel, gardé pour ne pas
// casser une éventuelle intégration future).
// Chemin dédié /ws pour ne jamais interférer avec les routes REST /api/*.
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const cookies = parseCookie(req.headers.cookie || "");
  const url = new URL(req.url, "http://localhost");
  const token = cookies.token || url.searchParams.get("token");
  let userId;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    userId = payload.sub;
  } catch {
    ws.close(4001, "Authentification invalide.");
    return;
  }

  registerSocket(userId, ws);
  ws.on("close", () => unregisterSocket(userId, ws));
  ws.on("error", () => unregisterSocket(userId, ws));
});

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log(`Moken CRM backend démarré sur http://localhost:${port}`);
});
