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

let _client = null;
function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto", // R2 n'a pas de notion de région AWS — "auto" est la valeur attendue par Cloudflare.
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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
