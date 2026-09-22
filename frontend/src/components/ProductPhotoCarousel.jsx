import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import PhotoLightbox from "./PhotoLightbox.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

// Carrousel photo pour les vignettes produit du catalogue (fiche corrective
// Administrateur V3, section carrousel) : swipe mobile/trackpad, flèches sur
// desktop, indicateur de position — et surtout, ne doit JAMAIS déclencher la
// sélection/quantité du produit qui vit dans la même carte (product-card).
// Chaque interaction du carrousel appelle donc systématiquement
// stopPropagation() pour ne jamais remonter au clic/à la carte parente.
//
// `photoUrls` (tableau, potentiellement vide) vient de GET /products, déjà
// renvoyé pour tous les rôles (cf. routes/products.js) — `photoUrl` seul
// reste utilisé en repli pour les produits sans galerie (aucune ligne dans
// product_photos), pour ne jamais rien casser d'existant.
//
// Photo cliquable -> vue en grand (demande directe : "rendre cliquable la
// photo et faire en sorte de pouvoir voir le produit en plus grand. On
// pourra activer le carroussel en plus grand. prevoir une croix pour
// fermer") : un clic sur l'image ouvre PhotoLightbox.jsx avec la galerie
// complète, ouverte sur la photo actuellement affichée dans la vignette.
// Correctif 2026-09-22 (demande client — "certaines photos ne s'affichent
// pas dans le catalogue") : diagnostic du protocole de stockage (R2 en
// production, cf. routes/products.js) n'a révélé aucune anomalie — le
// symptôme (icône "image cassée" du navigateur, PAS la case grise vide de
// la ligne juste au-dessus) veut dire que `photo_url` est bien renseignée
// en base mais que le fichier qu'elle désigne n'existe plus (typiquement,
// une fiche pas encore réimportée depuis l'incident de stockage du
// 2026-09-17, cf. commentaire products.js "423 photos cassées"). Plutôt que
// l'icône brute du navigateur (perturbante, ne dit rien à l'utilisateur),
// on affiche désormais un repli explicite dès que le chargement échoue —
// et, si la galerie a plusieurs photos, uniquement CETTE vignette bascule
// en repli (les autres continuent de s'afficher normalement).
export default function ProductPhotoCarousel({ photoUrls, fallbackUrl, alt }) {
  const { t } = useI18n();
  const urls = photoUrls && photoUrls.length > 0 ? photoUrls : fallbackUrl ? [fallbackUrl] : [];
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  if (urls.length === 0) {
    return <div style={{ height: 100, background: "var(--bg)" }} />;
  }

  const safeIndex = Math.min(index, urls.length - 1);
  const currentUrl = urls[safeIndex];
  const currentFailed = failedUrls.has(currentUrl);

  function handleError() {
    // eslint-disable-next-line no-console
    console.warn(`[ProductPhotoCarousel] Photo introuvable (404/erreur réseau) : ${currentUrl}`);
    setFailedUrls((prev) => (prev.has(currentUrl) ? prev : new Set(prev).add(currentUrl)));
  }

  function go(delta, e) {
    e.stopPropagation();
    e.preventDefault();
    setIndex((i) => (i + delta + urls.length) % urls.length);
  }

  function handleTouchStart(e) {
    e.stopPropagation();
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e) {
    e.stopPropagation();
    if (touchStartX == null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 30) {
      setIndex((i) => (i + (deltaX < 0 ? 1 : -1) + urls.length) % urls.length);
    }
    setTouchStartX(null);
  }

  // Trackpad/molette horizontale (deltaX) — desktop, sans clic requis.
  function handleWheel(e) {
    if (urls.length < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.stopPropagation();
    e.preventDefault();
    setIndex((i) => (i + (e.deltaX > 0 ? 1 : -1) + urls.length) % urls.length);
  }

  return (
    <div
      className="product-photo-carousel"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {currentFailed ? (
        <div className="product-photo-unavailable" title={currentUrl}>
          <ImageOff size={18} />
          <span>{t("productPhotoCarousel.unavailable")}</span>
        </div>
      ) : (
        <img
          src={currentUrl}
          alt={alt}
          style={{ cursor: "zoom-in" }}
          onError={handleError}
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(true);
          }}
        />
      )}
      {urls.length > 1 && (
        <>
          <button type="button" className="carousel-arrow left" onClick={(e) => go(-1, e)} aria-label="Previous photo">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="carousel-arrow right" onClick={(e) => go(1, e)} aria-label="Next photo">
            <ChevronRight size={14} />
          </button>
          <div className="carousel-dots">
            {urls.map((_, i) => (
              <span key={i} className={`carousel-dot ${i === safeIndex ? "active" : ""}`} />
            ))}
          </div>
        </>
      )}
      {lightboxOpen && (
        <PhotoLightbox photos={urls} initialIndex={safeIndex} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
