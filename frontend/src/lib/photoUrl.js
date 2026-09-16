// Aide d'affichage pour la vue "photo en grand" (PhotoLightbox.jsx).
//
// Les photos scrappées depuis mokenvision.com sont stockées (voir
// backend/scripts/mokenvision-photos/moken_photos_map.json, 278 entrées)
// sous la forme :
//   https://www.mokenvision.com/{id}-home_default/{slug}.jpg
// La variante "home_default" ne fait que 280x280 — suffisant pour une
// vignette de catalogue, mais trop petite pour un agrandissement plein
// écran net sur mobile (l'image serait étirée/pixelisée).
//
// mokenvision.com sert déjà les mêmes photos dans une variante bien plus
// grande, "superlarge_default" (1191x1191 — confirmé sur plusieurs
// produits), à une URL parfaitement prévisible : il suffit de remplacer
// le segment de taille dans l'URL. Aucune nouvelle infrastructure
// (stockage, retraitement d'image) n'est nécessaire pour ce fix.
//
// Cette transformation n'est appliquée qu'à l'affichage (au moment
// d'ouvrir la vue en grand) : les vignettes de la grille catalogue
// continuent d'utiliser l'URL "home_default" d'origine, plus légère et
// donc plus rapide à charger sur le terrain (données mobiles limitées).
//
// Les URLs qui ne suivent pas ce format (photos ajoutées à la main par un
// admin, servies depuis /uploads/products/..., ou toute autre URL
// externe) sont retournées telles quelles, inchangées.
const MOKENVISION_HOME_DEFAULT = /^(https:\/\/www\.mokenvision\.com\/\d+-)home_default(\/.+)$/;

export function largePhotoUrl(url) {
  if (typeof url !== "string") return url;
  const match = url.match(MOKENVISION_HOME_DEFAULT);
  if (match) {
    return `${match[1]}superlarge_default${match[2]}`;
  }
  return url;
}
