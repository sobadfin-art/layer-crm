import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

// Stockage des photos produit sur Cloudflare R2 (compatible API S3), remplace
// l'ancien `multer.diskStorage` local (correctif 2026-09-17, diagnostic
// "photos produit cassées le lendemain") : le disque du service Render
// gratuit est éphémère (confirmé par Render lui-même : "Disks are not
// supported for free compute plans") — tout fichier écrit à l'exécution est
// perdu au prochain redémarrage de conteneur (veille/réveil du plan gratuit,
// ou redéploiement). R2 est un stockage objet externe et persistant,
// totalement indépendant du cycle de vie du service backend.
//
// Bucket volontairement PRIVÉ (pas de "Public Access" côté Cloudflare) —
// demande explicite du client (2026-09-17) : aucune photo pas encore publiée
// sur mokenvision.com ne doit pouvoir être scrapée par un bot qui ne serait
// pas authentifié dans le CRM. Les objets ne sont donc jamais exposés par une
// URL R2 directe ; ils sont relus côté serveur (getObject ci-dessous) et
// reservis par une route Express derrière `requireAuth` (cf.
// routes/products.js, GET /uploads/products/:filename) — un bot anonyme ne
// peut rien récupérer sans un cookie de session valide du CRM.
//
// Variables d'environnement requises (jamais de valeur en dur ici, jamais
// commitées) :
//   R2_ACCOUNT_ID          — identifiant de compte Cloudflare (URL endpoint)
//   R2_ACCESS_KEY_ID       — clé d'accès du token API R2 (S3-compatible)
//   R2_SECRET_ACCESS_KEY   — clé secrète du même token
//   R2_BUCKET_NAME         — nom du bucket R2 dédié à ce projet
//
// `isObjectStorageConfigured()` permet aux routes de détecter une config
// incomplète au démarrage plutôt que d'échouer au premier upload avec une
// erreur AWS SDK peu lisible.
const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

export function isObjectStorageConfigured() {
  return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
}

export function missingObjectStorageEnvVars() {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

// Nettoie une valeur R2_ACCOUNT_ID mal saisie (ex. l'utilisateur colle l'URL
// d'endpoint entière affichée par Cloudflare au lieu du seul identifiant de
// compte) — correctif 2026-09-17 après incident en production : la valeur
// entrée était "https://<id>.r2.cloudflarestorage.com" au lieu de "<id>" tout
// court. Résultat concret observé : l'endpoint construit devenait
// "https://https://<id>.r2.cloudflarestorage.com.r2.cloudflarestorage.com",
// que `new URL()` interprète avec pour hostname le seul mot "https" (le
// deuxième "https://" est traité comme le host, tout le reste comme un
// chemin) — combiné à l'adressage "virtual-hosted-style" par défaut du SDK
// AWS (bucket ajouté devant le host), la requête partait vers
// "<bucket>.https", d'où l'erreur `getaddrinfo ENOTFOUND <bucket>.https` vue
// dans les logs Render. On accepte ici aussi bien la forme correcte que les
// formes collées par erreur (avec "https://" et/ou le suffixe complet), pour
// qu'une future faute de frappe similaire n'empêche plus le démarrage.
function sanitizeAccountId(raw) {
  if (!raw) return raw;
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\.r2\.cloudflarestorage\.com\/?$/i, "");
}

let _client = null;
function getClient() {
  if (_client) return _client;
  const accountId = sanitizeAccountId(process.env.R2_ACCOUNT_ID);
  _client = new S3Client({
    region: "auto", // R2 n'a pas de notion de région AWS — "auto" est la valeur attendue par Cloudflare.
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    // R2 ne supporte pas l'adressage "virtual-hosted-style" (bucket en
    // sous-domaine, ex. "<bucket>.<compte>.r2.cloudflarestorage.com") —
    // uniquement l'adressage "path-style" (bucket dans le chemin, ex.
    // "<compte>.r2.cloudflarestorage.com/<bucket>/..."), contrairement au
    // comportement par défaut du SDK AWS S3 v3 qui suppose virtual-hosted-style
    // pour un endpoint personnalisé. Sans ce réglage, même une fois
    // R2_ACCOUNT_ID corrigé, les requêtes auraient continué à échouer (DNS
    // introuvable pour un sous-domaine par bucket que R2 ne provisionne pas).
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

function assertConfigured() {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      `Stockage R2 non configuré — variables manquantes : ${missingObjectStorageEnvVars().join(", ")}`
    );
  }
}

// Dépose un fichier dans le bucket. `key` = chemin complet dans le bucket
// (ex. "products/<uuid>-<ts>-<rand>.jpg"). Ne renvoie aucune URL publique —
// le bucket est privé, cf. commentaire plus haut.
export async function putObject({ key, body, contentType }) {
  assertConfigured();
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

// Relit un objet pour le reservir via notre propre route authentifiée (jamais
// exposé tel quel au navigateur). Renvoie { stream, contentType, contentLength }.
export async function getObject({ key }) {
  assertConfigured();
  const client = getClient();
  const result = await client.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
  );
  return {
    stream: result.Body, // Readable (Node) côté backend Express.
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

export async function deleteObject({ key }) {
  if (!isObjectStorageConfigured()) return;
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
  );
}
