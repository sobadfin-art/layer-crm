import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PhotoLightbox from "./PhotoLightbox.jsx";

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
export default function ProductPhotoCarousel({ photoUrls, fallbackUrl, alt }) {
  const urls = photoUrls && photoUrls.length > 0 ? photoUrls : fallbackUrl ? [fallbackUrl] : [];
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (urls.length === 0) {
    return <div style={{ height: 100, background: "var(--bg)" }} />;
  }

  const safeIndex = Math.min(index, urls.length - 1);

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
      <img
        src={urls[safeIndex]}
        alt={alt}
        style={{ cursor: "zoom-in" }}
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
      />
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
