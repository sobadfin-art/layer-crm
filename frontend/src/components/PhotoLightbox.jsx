import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { largePhotoUrl } from "../lib/photoUrl";
import { useI18n } from "../i18n/I18nContext.jsx";

// Vue "photo en grand" (demande directe : "rendre cliquable la photo et
// faire en sorte de pouvoir voir le produit en plus grand. On pourra
// activer le carroussel en plus grand. prevoir une croix pour fermer") —
// composant partagé, ouvert au clic sur une photo de fiche produit
// (Catalogue.jsx, NewOrder.jsx, CatalogueConsult.jsx, CatalogueAdmin.jsx).
// Reprend la convention .modal-overlay/.modal-box déjà en place (galerie
// photo Admin, CatalogueAdmin.jsx — overlay plein écran cliquable pour
// fermer, boîte interne qui stoppe la propagation) pour rester cohérent,
// avec ses propres classes `.lightbox-*` pour l'affichage plein écran de
// la photo et la navigation carrousel en grand.
export default function PhotoLightbox({ photos, initialIndex = 0, alt, onClose }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(initialIndex);
  // Même correctif que ProductPhotoCarousel.jsx (2026-09-22) : repli propre
  // si la photo en grand échoue aussi, plutôt que l'icône brute du navigateur.
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  // Toujours repartir de la photo affichée dans la vignette au moment du
  // clic, y compris si le lightbox était déjà monté pour une autre fiche.
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  // Échap pour fermer, flèches gauche/droite pour naviguer — en plus des
  // boutons cliquables, pour un usage clavier confortable en plein écran.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && photos.length > 1) {
        setIndex((i) => (i - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight" && photos.length > 1) {
        setIndex((i) => (i + 1) % photos.length);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, onClose]);

  if (!photos || photos.length === 0) return null;
  const safeIndex = Math.min(index, photos.length - 1);
  const currentLargeUrl = largePhotoUrl(photos[safeIndex]);
  const currentFailed = failedUrls.has(currentLargeUrl);

  function go(delta, e) {
    e.stopPropagation();
    setIndex((i) => (i + delta + photos.length) % photos.length);
  }

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {currentFailed ? (
          <div className="lightbox-image lightbox-unavailable">
            <ImageOff size={32} />
            <span>{t("productPhotoCarousel.unavailable")}</span>
          </div>
        ) : (
          <img
            src={currentLargeUrl}
            alt={alt}
            className="lightbox-image"
            onError={() =>
              setFailedUrls((prev) => (prev.has(currentLargeUrl) ? prev : new Set(prev).add(currentLargeUrl)))
            }
          />
        )}
        {photos.length > 1 && (
          <>
            <button type="button" className="lightbox-arrow left" onClick={(e) => go(-1, e)} aria-label="Photo précédente">
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="lightbox-arrow right" onClick={(e) => go(1, e)} aria-label="Photo suivante">
              <ChevronRight size={22} />
            </button>
            <div className="lightbox-dots">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`lightbox-dot ${i === safeIndex ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                />
              ))}
            </div>
            <div className="lightbox-counter">
              {safeIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
      {/* Placé après .lightbox-content dans le DOM (et avec son propre
          z-index en CSS) pour rester cliquable au-dessus de l'image même
          une fois celle-ci agrandie près du plein écran sur mobile. */}
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Fermer">
        <X size={20} />
      </button>
    </div>
  );
}
