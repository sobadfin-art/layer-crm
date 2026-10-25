import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { currencyForCountry, money, shortDate } from "../lib/format.js";
import ProductPhotoCarousel from "../components/ProductPhotoCarousel.jsx";
import OrderDraftsPanel from "../components/OrderDraftsPanel.jsx";
import { deleteDraft, getDraft, listDrafts, newDraftId, saveDraft } from "../lib/orderDrafts.js";

// Délai de débounce de la sauvegarde automatique du brouillon local (point 8).
const DRAFT_SAVE_DELAY_MS = 1000;

const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

// Même règle d'affichage du stock que Catalogue.jsx (stockLine) — reprise ici
// telle quelle car la fiche corrective Représentant demande que le statut
// stock/réassort soit visible directement au moment de la prise de commande,
// pas seulement dans le catalogue de consultation séparé.
function stockLine(p, t, locale) {
  if (p.stockStatus === "EN_STOCK") {
    return { text: t("catalogue.stockEnStock"), color: "var(--teal)" };
  }
  if (p.stockStatus === "REASSORT_PREVU") {
    return {
      text: p.restockDate ? t("catalogue.restockOn", { date: shortDate(p.restockDate, locale) }) : t("catalogue.restockUnknown"),
      color: "var(--danger)",
    };
  }
  return {
    text: p.restockDate ? t("catalogue.outOfStockReturn", { date: shortDate(p.restockDate, locale) }) : t("catalogue.outOfStockUnknown"),
    color: "var(--danger)",
  };
}

// GROS BUG CORRIGÉ (2026-09-16) — même correction que lib/pricing.js côté
// serveur (source de vérité) : l'Espagne bénéficiait à tort du prix France.
// Règle confirmée : seule la France a le prix France, la Suisse a le prix
// Suisse, tous les autres pays (Europe, DOM-TOM compris) ont le prix Export.
// Ceci reste un APERÇU (cf. commentaire plus bas) — le serveur recalcule
// toujours le prix réel à l'enregistrement, jamais fait confiance à ce calcul
// client.
//
// Point 7 (2026-10-25) : client suisse → prix Suisse en CHF EXCLUSIVEMENT.
// Un prix Suisse vide renvoie `null` (jamais 0, jamais le prix en euros) : la
// référence n'est alors pas ajoutable au panier ("prix suisse non
// renseigné"), et le serveur la refuse de toute façon.
function unitPriceFor(product, countryCode) {
  if (countryCode === "FR") return Number(product.priceFr) || 0;
  if (countryCode === "CH") return product.priceCh === null || product.priceCh === undefined ? null : Number(product.priceCh);
  return Number(product.priceExport) || 0;
}

function isSwissPriceMissing(product, countryCode) {
  return countryCode === "CH" && (product.priceCh === null || product.priceCh === undefined);
}

// Même choix de règle de frais de port que le serveur (lib/pricing.js,
// pickShippingRule) : une commande en CHF ne retient qu'une règle "Pays :
// Suisse" (montants en CHF) ; une commande en EUR ne la retient jamais.
function pickShippingRule(rules, currency) {
  const active = rules.filter((r) => r.type === "FRAIS_DE_PORT" && r.active);
  const isSwiss = (r) => r.scope === "PAYS" && r.countryCode === "CH";
  if (currency === "CHF") return active.find(isSwiss) || null;
  return active.find((r) => !isSwiss(r)) || null;
}

// Choisit la règle de remise catégorie la plus spécifique (Représentant >
// Pays > Global) — même logique de priorité que lib/pricing.js côté serveur.
// Depuis la migration 013, une règle de portée REPRESENTANT cible une
// sélection multiple de représentants (`repIds`) plutôt qu'un seul : le
// bouton de remise n'apparaît que pour les représentants inclus dans cette
// sélection, qui choisissent ensuite de l'activer ou non par commande.
// Ceci n'est qu'un APERÇU affiché au représentant : le serveur recalcule
// toujours la remise réelle à l'enregistrement de la commande (POST /api/orders),
// jamais fait confiance à ce que le client envoie.
//
// BUG CORRIGÉ (fiche corrective "CORRECTIFS PRIORITAIRES — DIRECTION
// COMMERCIALE + REPRÉSENTANT + RÈGLES DE REMISE", section 4/6 : "la remise ne
// s'applique pas"). `r.categories` est déjà un tableau JS natif tel que
// renvoyé par GET /api/business-rules (node-pg parse nativement les colonnes
// PostgreSQL `product_category[]`) — un ancien appel à un helper
// `parsePgArray(str)` prévu pour un LITTÉRAL texte brut de type `"{PREMIUM}"`
// recevait donc directement un tableau, échouait sa vérification
// `typeof str !== "string"` et renvoyait systématiquement `[]`. Résultat :
// TOUTE règle de remise apparaissait ici comme "sans restriction de
// catégorie" (`cats.length === 0` toujours vrai), y compris des règles
// explicitement limitées à une seule catégorie — une règle de portée
// REPRESENTANT/GLOBAL non pertinente pour la catégorie en cours pouvait donc
// masquer, dans cet APERÇU seulement, la règle PAYS réellement applicable
// (ex. la règle France de la catégorie concernée), donnant l'impression
// trompeuse que "la remise France ne s'applique pas" alors que le serveur,
// qui n'a jamais eu ce bug (lib/pricing.js#pickRule utilise `r.categories`
// directement), calculait déjà le bon montant à l'enregistrement — vérifié
// par une commande réelle avant ce correctif (règle PAYS/France/CLASSIC/20%
// correctement appliquée côté serveur, alors que l'aperçu panier affichait à
// tort la règle REPRESENTANT/PREMIUM/25%). Corrigé en utilisant
// `r.categories` tel quel, cohérent avec le serveur.
function pickDiscountRule(rules, category, repId, countryId) {
  const candidates = rules.filter((r) => {
    if (r.type !== "REMISE_CATEGORIE" || !r.active) return false;
    const cats = r.categories || [];
    return cats.length === 0 || cats.includes(category);
  });
  return (
    candidates.find((r) => r.scope === "REPRESENTANT" && (r.repIds || []).includes(repId)) ||
    candidates.find((r) => r.scope === "PAYS" && r.countryId === countryId) ||
    candidates.find((r) => r.scope === "GLOBAL") ||
    null
  );
}

// Point 2 (2026-10-25) : quantité modifiable directement sur chaque ligne du
// récapitulatif (boutons −/+ et saisie directe). La saisie clavier garde une
// valeur locale tant que le champ a le focus : effacer "5" pour taper "8" ne
// doit jamais déclencher la suppression de la ligne en cours de frappe. La
// valeur n'est validée qu'au fil de la saisie si elle est > 0, et à la sortie
// du champ sinon — une quantité à 0 (bouton − ou saisie) demande toujours
// confirmation avant de retirer la ligne.
function CartLineQty({ qty, label, onChange, t }) {
  const [draft, setDraft] = useState(null);

  function commit(next) {
    if (next > 0) {
      onChange(next);
      return;
    }
    if (window.confirm(t("newOrder.removeLineConfirm", { label }))) onChange(0);
  }

  return (
    <div className="qty-row cart-qty">
      <button type="button" aria-label={t("newOrder.qtyDecrease")} onClick={() => commit(qty - 1)}>
        <Minus size={14} />
      </button>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        className="qty-input"
        aria-label={t("newOrder.qtyInputLabel")}
        value={draft ?? qty}
        onFocus={(e) => {
          setDraft(String(qty));
          e.target.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = Math.floor(Number(e.target.value));
          if (parsed > 0) onChange(parsed);
        }}
        onBlur={() => {
          const parsed = Math.max(0, Math.floor(Number(draft) || 0));
          setDraft(null);
          if (parsed !== qty) commit(parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
      />
      <button type="button" aria-label={t("newOrder.qtyIncrease")} onClick={() => commit(qty + 1)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

// Prise de commande + panier, combinés en un seul écran (deux sous-vues
// internes, fidèle à la maquette docs/prototype-crm-commercial.jsx —
// view === "prise-commande" / "panier") pour ne pas perdre l'état du panier
// entre deux routes. Toujours rattachée à un compte (accountId dans l'URL),
// jamais accessible depuis le catalogue de référence.
//
// Point 8 (brouillons) : l'écran est remonté à neuf à chaque changement de
// compte (key={id}) — reprendre le brouillon d'un AUTRE compte depuis cet
// écran ne doit jamais mélanger son panier avec celui du compte courant.
export default function NewOrder() {
  const { id } = useParams();
  return <NewOrderScreen key={id} />;
}

function NewOrderScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const { user } = useAuth();

  const [account, setAccount] = useState(null);
  const [products, setProducts] = useState([]);
  // Produits accumulés au fil des changements de catalogue (fiche corrective
  // Parcours de création de commande, section 4 : "Autoriser plusieurs
  // catalogues actifs si nécessaire" + section 7 "le panier doit être
  // conservé jusqu'au récapitulatif"). `products` ci-dessus ne reflète que le
  // catalogue actuellement parcouru (pour la grille) ; `productsById` garde
  // TOUS les produits déjà rencontrés dans cette session de commande, y
  // compris ceux d'un catalogue quitté depuis, pour que le panier et le
  // récapitulatif puissent continuer à les résoudre même après un changement
  // de catalogue.
  const [productsById, setProductsById] = useState(new Map());
  const [rules, setRules] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtre Catalogue (fiche corrective P0 — Profil Représentant, section 1) :
  // sélection multiple de bulles directement sur la page Nouvelle commande,
  // plus d'étape intermédiaire. selectedCatalogIds === [] tant qu'aucun
  // catalogue n'est sélectionné ; dans ce cas la grille reste vide et l'ajout
  // au panier est bloqué (section E).
  const [selectedCatalogIds, setSelectedCatalogIds] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [subview, setSubview] = useState("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  // cart: Map productId -> { qty, isGift }
  const [cart, setCart] = useState(new Map());
  // Correctif 2026-09-16 (demande directe Direction Commerciale : "dans la
  // partie representant, le niveau de remise (bouton) est par défaut non
  // enclanché. Le représentant l'enclenchera lui meme manuellement si il
  // veut l'enclencher") — objet toujours vide au départ, mais désormais lu
  // partout ci-dessous avec `=== true` (et non plus `!== false`) : une
  // catégorie absente de cet objet (donc `undefined`) vaut maintenant
  // "remise NON appliquée" par défaut, jamais l'inverse. Le représentant
  // doit cliquer le bouton pour l'activer lui-même, catégorie par
  // catégorie ; rien n'est présélectionné.
  const [discountApplied, setDiscountApplied] = useState({}); // par catégorie
  const [shippingOffered, setShippingOffered] = useState(false);
  const [isPrecommande, setIsPrecommande] = useState(false);
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [toast, setToast] = useState(null);

  // Brouillon local (point 8). L'identifiant du brouillon en cours est porté
  // par l'URL (?draft=…, posé en `replace` à la première sauvegarde) : un
  // refresh ou un retour arrière du navigateur rouvre donc exactement ce
  // brouillon, sans action du représentant. Une ouverture "neuve" de l'écran
  // (sans ?draft) ne reprend jamais rien d'office — elle liste les brouillons
  // existants, et la nouvelle saisie démarre son propre brouillon, sans
  // jamais écraser un brouillon non repris.
  const draftIdRef = useRef(searchParams.get("draft") || null);
  const pendingDraftRef = useRef(null);
  const draftTimerRef = useRef(null);
  const submittedRef = useRef(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedCatalogIds([]);
    setProducts([]);
    Promise.all([api.get(`/accounts/${id}`), api.get("/catalogs"), api.get("/business-rules")])
      .then(([accountData, catalogsData, rulesData]) => {
        setAccount(accountData);
        setCatalogs(catalogsData);
        setRules(rulesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Les catalogues proposés à la sélection sont les catalogues actifs
  // contenant au moins une référence.
  const selectableCatalogs = useMemo(
    () => catalogs.filter((c) => c.active && (c.productCount ?? 0) > 0),
    [catalogs]
  );

  // Bascule (ajout/retrait) d'un catalogue dans la sélection multiple —
  // fiche corrective P0, section C : bulles à sélection multiple, jamais un
  // <select>. Ne touche jamais au panier ni à la sous-vue : la grille se met
  // simplement à jour avec les produits des catalogues sélectionnés.
  function toggleCatalog(catalogId) {
    setSelectedCatalogIds((prev) =>
      prev.includes(catalogId) ? prev.filter((c) => c !== catalogId) : [...prev, catalogId]
    );
  }

  // Recharge la grille à chaque changement de sélection de catalogue(s),
  // sans jamais réinitialiser le panier (section D) ni la recherche/le
  // filtre catégorie en cours (pas de "rechargement complet du parcours").
  // Le backend supporte déjà le filtre OR multi-catalogue via
  // ?catalogId=A,B (voir routes/products.js, ajouté pour le Catalogue Admin).
  useEffect(() => {
    if (selectedCatalogIds.length === 0) {
      setProducts([]);
      return;
    }
    setProductsLoading(true);
    setError(null);
    api
      .get(`/products?catalogId=${selectedCatalogIds.join(",")}`)
      .then((productsData) => {
        setProducts(productsData);
        // Fusion dans l'accumulateur global plutôt que remplacement : un
        // produit déjà présent (ex. reference partagée entre catalogues) est
        // simplement mis à jour, jamais perdu — le panier peut ainsi
        // toujours résoudre un article ajouté sous une sélection de
        // catalogues différente de la sélection courante.
        setProductsById((prev) => {
          const next = new Map(prev);
          for (const p of productsData) next.set(p.id, p);
          return next;
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setProductsLoading(false));
  }, [selectedCatalogIds]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshDrafts = useCallback(() => setDrafts(listDrafts(user?.id)), [user?.id]);

  // Écrit immédiatement le dernier état en attente (sans attendre le
  // débounce) — appelé quand l'app passe en arrière-plan (appel entrant,
  // changement d'app sur mobile : une PWA peut être tuée sans autre
  // préavis), à la fermeture de l'onglet et en quittant l'écran.
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimerRef.current);
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    if (!pending || submittedRef.current) return;
    if (pending.empty) deleteDraft(user?.id, pending.draftId);
    else saveDraft(user?.id, pending);
  }, [user?.id]);

  // Recharge l'état exact d'un brouillon. Les produits du panier sont
  // restaurés depuis l'instantané du brouillon (pour qu'ils restent
  // affichables même si leur catalogue n'est plus sélectionné), puis
  // rafraîchis par le rechargement des catalogues sélectionnés. Seuls les
  // catalogues encore actifs sont resélectionnés. Le prix affiché reste un
  // aperçu : le serveur le recalcule toujours à l'envoi.
  function applyDraft(draft) {
    const selectable = new Set(catalogs.filter((c) => c.active && (c.productCount ?? 0) > 0).map((c) => c.id));
    setProductsById((prev) => {
      const next = new Map(prev);
      for (const p of draft.products || []) if (!next.has(p.id)) next.set(p.id, p);
      return next;
    });
    setCart(new Map(draft.cart || []));
    setSelectedCatalogIds((draft.selectedCatalogIds || []).filter((c) => selectable.has(c)));
    setDiscountApplied(draft.discountApplied || {});
    setShippingOffered(Boolean(draft.shippingOffered));
    setIsPrecommande(Boolean(draft.isPrecommande));
    setDesiredDeliveryDate(draft.desiredDeliveryDate || "");
    setNote(draft.note || "");
    setSearch(draft.search || "");
    setCategory(draft.category || "all");
    setSubview(draft.subview === "cart" ? "cart" : "browse");
    draftIdRef.current = draft.draftId;
  }

  // Restauration automatique du brouillon désigné par ?draft=… une fois le
  // compte et les catalogues chargés (jamais avant : le chargement initial
  // réinitialise la sélection de catalogues).
  useEffect(() => {
    if (loading || !account || draftHydrated) return;
    const draft = getDraft(user?.id, draftIdRef.current);
    if (draft && draft.accountId === id) {
      applyDraft(draft);
    } else if (draftIdRef.current) {
      // Brouillon introuvable (supprimé, expiré, autre appareil/utilisateur)
      // ou d'un autre compte : on repart d'une saisie vierge, sans rien
      // réutiliser.
      draftIdRef.current = null;
      setSearchParams({}, { replace: true });
    }
    refreshDrafts();
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, account, draftHydrated]);

  // Sauvegarde automatique, débouncée, à chaque modification de la saisie.
  // Rien n'est enregistré tant que la saisie est vide (simple consultation du
  // catalogue) ; si un brouillon existant est vidé, il est supprimé.
  useEffect(() => {
    if (!draftHydrated || !account || submittedRef.current) return;
    const hasContent =
      cart.size > 0 ||
      note.trim() !== "" ||
      desiredDeliveryDate !== "" ||
      isPrecommande ||
      shippingOffered ||
      Object.values(discountApplied).some((v) => v === true);
    if (!hasContent && !draftIdRef.current) return;
    if (!draftIdRef.current) {
      draftIdRef.current = newDraftId();
      setSearchParams({ draft: draftIdRef.current }, { replace: true });
    }
    pendingDraftRef.current = hasContent
      ? {
          draftId: draftIdRef.current,
          accountId: id,
          accountName: account.name,
          cart: [...cart.entries()],
          products: [...cart.keys()]
            .map((pid) => productsById.get(pid) || productById.get(pid))
            .filter(Boolean),
          selectedCatalogIds,
          discountApplied,
          shippingOffered,
          isPrecommande,
          desiredDeliveryDate,
          note,
          search,
          category,
          subview,
        }
      : { draftId: draftIdRef.current, empty: true };
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftHydrated,
    cart,
    note,
    desiredDeliveryDate,
    isPrecommande,
    shippingOffered,
    discountApplied,
    selectedCatalogIds,
    search,
    category,
    subview,
  ]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushDraft();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  function resumeDraft(draft) {
    flushDraft();
    if (draft.accountId !== id) {
      navigate(`/clients/${draft.accountId}/commande?draft=${encodeURIComponent(draft.draftId)}`);
      return;
    }
    applyDraft(draft);
    setSearchParams({ draft: draft.draftId }, { replace: true });
    refreshDrafts();
  }

  function removeDraft(draft) {
    deleteDraft(user?.id, draft.draftId);
    refreshDrafts();
  }

  const otherDrafts = drafts.filter((d) => d.draftId !== draftIdRef.current);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => p.category === c)),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.productStatus === "DISCONTINUE") return false;
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return [p.ref, p.label, p.model, p.color].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [products, search, category]);

  function changeQty(productId, delta) {
    // Garde-fou (section E) : aucun ajout possible tant qu'aucun catalogue
    // n'est sélectionné. Backstop défensif — la grille est de toute façon
    // vide dans ce cas, donc ce chemin ne devrait normalement pas être
    // atteint depuis l'UI.
    if (selectedCatalogIds.length === 0) return;
    if (delta > 0 && blockedForSwissPrice(productId)) return;
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { qty: 0, isGift: false };
      const qty = Math.max(0, current.qty + delta);
      if (qty === 0) {
        next.delete(productId);
      } else {
        next.set(productId, { ...current, qty });
      }
      return next;
    });
  }

  // Saisie directe de la quantité (fiche Parcours de création de commande,
  // section 4 : "boutons +/- et/ou saisie directe"), en plus des boutons.
  function setQtyDirect(productId, rawValue) {
    if (selectedCatalogIds.length === 0) return;
    const parsed = Math.max(0, Math.floor(Number(rawValue) || 0));
    if (parsed > 0 && blockedForSwissPrice(productId)) return;
    setCart((prev) => {
      const next = new Map(prev);
      if (parsed === 0) {
        next.delete(productId);
      } else {
        const current = next.get(productId) || { qty: 0, isGift: false };
        next.set(productId, { ...current, qty: parsed });
      }
      return next;
    });
  }

  // Point 7 : garde-fou d'ajout — une référence sans prix Suisse ne peut pas
  // entrer dans le panier d'un client suisse.
  function blockedForSwissPrice(productId) {
    const product = productsById.get(productId) || products.find((p) => p.id === productId);
    return Boolean(product && account && isSwissPriceMissing(product, account.countryCode));
  }

  // Modification de quantité depuis le récapitulatif (point 2) — volontairement
  // sans le garde-fou "catalogue sélectionné" de changeQty/setQtyDirect : une
  // ligne déjà au panier reste modifiable même si son catalogue a été
  // désélectionné depuis (ou après reprise d'un brouillon).
  function setCartLineQty(productId, qty) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (!current) return prev;
      if (qty <= 0) next.delete(productId);
      else next.set(productId, { ...current, qty });
      return next;
    });
  }

  function toggleGift(productId) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (!current) return prev;
      next.set(productId, { ...current, isGift: !current.isGift });
      return next;
    });
  }

  const cartItems = useMemo(() => {
    return [...cart.entries()]
      .map(([productId, entry]) => {
        // Résolu contre l'accumulateur global (productsById), pas seulement
        // le catalogue actuellement parcouru, pour que les articles d'un
        // catalogue quitté restent visibles au panier / récapitulatif.
        const product = productsById.get(productId) || productById.get(productId);
        if (!product) return null;
        const unitPrice = account ? unitPriceFor(product, account.countryCode) ?? 0 : 0;
        return { productId, product, ...entry, unitPrice };
      })
      .filter(Boolean);
  }, [cart, productById, productsById, account]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const byCategory = useMemo(() => {
    const groups = {};
    for (const item of cartItems) {
      const cat = item.product.category;
      groups[cat] = groups[cat] || { items: [], subtotal: 0 };
      groups[cat].items.push(item);
      if (!item.isGift) groups[cat].subtotal += item.unitPrice * item.qty;
    }
    return groups;
  }, [cartItems]);

  function discountRateFor(cat) {
    if (!account) return 0;
    const rule = pickDiscountRule(rules, cat, account.ownerRepId, account.countryId);
    return rule ? Number(rule.ratePct) || 0 : 0;
  }

  // Point 7 : devise de la commande (pays du compte). Tous les montants de cet
  // écran sont formatés dans cette devise — aucun symbole € sur une commande
  // suisse.
  const currency = account ? currencyForCountry(account.countryCode) : "EUR";
  const fmt = (n) => money(n, locale, currency);
  const shippingRule = pickShippingRule(rules, currency);
  // Client suisse sans règle de frais de port Suisse : port "à définir" —
  // aucun montant inventé (jamais les 9,60 € par défaut renommés en CHF).
  const shippingToDefine = currency === "CHF" && (!shippingRule || shippingRule.flatAmount == null);
  const shippingAmount = shippingToDefine ? 0 : shippingRule?.flatAmount != null ? Number(shippingRule.flatAmount) : 9.6;
  const shippingThreshold = shippingToDefine ? null : shippingRule?.threshold != null ? Number(shippingRule.threshold) : null;

  const totalAmount = cartItems.reduce((s, i) => {
    if (i.isGift) return s;
    const rate = discountApplied[i.product.category] === true ? discountRateFor(i.product.category) : 0;
    return s + i.unitPrice * i.qty * (1 - rate / 100);
  }, 0);
  const shippingAutoEligible = shippingThreshold !== null && totalAmount >= shippingThreshold;
  const grandTotal = shippingOffered || shippingAutoEligible ? totalAmount : totalAmount + shippingAmount;
  const shippingLabel =
    shippingOffered || shippingAutoEligible
      ? t("newOrder.shippingOffered")
      : shippingToDefine
      ? t("newOrder.shippingToDefine")
      : fmt(shippingAmount);

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    // Correctif 2026-09-18 (fiche "UPDATE CRM" évolution 3) : date de
    // livraison obligatoire avant validation/envoi — vérifiée aussi côté
    // serveur (orders.js, POST /:id/send-to-front-desk) pour ne pas pouvoir
    // être contournée par un appel API direct.
    if (!desiredDeliveryDate) {
      setSubmitError(t("newOrder.deliveryDateRequired"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const lines = cartItems.map((item) => {
        const applied = discountApplied[item.product.category] === true;
        const isReliquat = !isPrecommande && item.product.stockStatus === "REASSORT_PREVU";
        return {
          productId: item.productId,
          qty: item.qty,
          isGift: item.isGift,
          discountPct: item.isGift ? undefined : applied ? undefined : 0,
          isReliquat,
        };
      });

      const order = await api.post("/orders", {
        accountId: id,
        isPrecommande,
        desiredDeliveryDate: desiredDeliveryDate ? new Date(`${desiredDeliveryDate}T00:00:00`).toISOString() : null,
        note: note.trim() || null,
        shippingOffered,
        lines,
      });

      await api.post(`/orders/${order.id}/send-to-front-desk`);

      // Point 8 : le brouillon local n'est supprimé qu'ici, une fois la
      // commande créée ET envoyée avec succès — jamais avant, pour qu'un
      // échec d'envoi ne fasse jamais perdre la saisie.
      submittedRef.current = true;
      clearTimeout(draftTimerRef.current);
      pendingDraftRef.current = null;
      if (draftIdRef.current) deleteDraft(user?.id, draftIdRef.current);

      setCart(new Map());
      // Le Directeur n'a pas d'écran /commandes séparé (celui-ci reste pensé
      // pour la vue "mes commandes" Représentant/Master Rep) : après envoi il
      // est renvoyé vers /orders, sa vue globale déjà existante (fiche
      // corrective Direction Commerciale V3 — même parcours de commande,
      // atterrissage adapté au rôle).
      navigate(user?.role === "DIRECTEUR" ? "/orders" : "/commandes", { state: { toast: t("newOrder.submitSuccess") } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="empty-state">{t("account.loading")}</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!account) return <p className="error-text">{t("account.notFound")}</p>;

  // Correctif 2026-09-18 (fiche "UPDATE CRM" évolution 2) : deuxième point
  // d'accès au panier en haut à droite du catalogue, en plus du bouton du
  // bas conservé tel quel. Fonction partagée (et non deux JSX dupliqués) pour
  // que les deux boutons restent garantis strictement synchronisés — même
  // libellé, même compteur (cartCount), même action (setSubview("cart")),
  // même vue panier ouverte ensuite.
  function renderCartButton(extraStyle) {
    if (cartCount <= 0) return null;
    return (
      <button
        type="button"
        className="btn primary"
        style={{ display: "flex", alignItems: "center", gap: 6, ...extraStyle }}
        onClick={() => setSubview("cart")}
      >
        <ShoppingCart size={15} /> {t("newOrder.viewCart", { count: cartCount })}
      </button>
    );
  }

  return (
    <>
      <button className="btn outline" style={{ marginBottom: 14 }} onClick={() => navigate(`/clients/${id}`)}>
        <ArrowLeft size={14} /> {t("newOrder.backToClient")}
      </button>

      {subview === "browse" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h1 className="page-title">{t("newOrder.title", { name: account.name })}</h1>
              <p className="page-sub">{t("newOrder.subtitle")}</p>
            </div>
            {renderCartButton({ marginTop: 2 })}
          </div>

          <OrderDraftsPanel drafts={otherDrafts} onResume={resumeDraft} onDelete={removeDraft} t={t} locale={locale} />

          <div className="filter-label" style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, marginTop: 4 }}>
            {t("newOrder.catalogFilterLabel")}
          </div>
          {selectableCatalogs.length > 0 && (
            <div className="cat-tabs" style={{ marginBottom: 10 }}>
              {selectableCatalogs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-tab ${selectedCatalogIds.includes(c.id) ? "active" : ""}`}
                  onClick={() => toggleCatalog(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {selectableCatalogs.length === 0 && <p className="empty-state">{t("newOrder.catalogEmpty")}</p>}

          <div className="search-bar">
            <Search size={15} color="#8892a0" />
            <input placeholder={t("catalogue.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="cat-tabs">
            <button className={`cat-tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
              {t("catalogue.filterAll")}
            </button>
            {presentCategories.map((c) => (
              <button key={c} className={`cat-tab ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
                {t(`category.${c}`)}
              </button>
            ))}
          </div>

          {selectedCatalogIds.length === 0 && (
            <p className="empty-state" style={{ fontWeight: 600 }}>
              {t("newOrder.selectCatalogRequired")}
            </p>
          )}

          {selectedCatalogIds.length > 0 && productsLoading && (
            <p className="empty-state">{t("newOrder.catalogLoading")}</p>
          )}

          {selectedCatalogIds.length > 0 && !productsLoading && filtered.length === 0 && (
            <p className="empty-state">{t("catalogue.empty")}</p>
          )}

          <div className="product-grid">
            {selectedCatalogIds.length > 0 && !productsLoading && filtered.map((p) => {
              const entry = cart.get(p.id);
              const price = account ? unitPriceFor(p, account.countryCode) : null;
              const swissMissing = account ? isSwissPriceMissing(p, account.countryCode) : false;
              const stock = stockLine(p, t, locale);
              return (
                <div className="product-card" key={p.id}>
                  <ProductPhotoCarousel photoUrls={p.photoUrls} fallbackUrl={p.photoUrl} alt={p.label} />
                  <div className="product-body">
                    <div className="product-ref">{p.ref}</div>
                    <div className="product-name">{p.label}</div>
                    <div className="product-price">
                      {swissMissing ? (
                        <span style={{ color: "var(--danger)" }}>{t("newOrder.swissPriceMissing")}</span>
                      ) : price ? (
                        fmt(price)
                      ) : (
                        t("catalogue.priceUnset")
                      )}
                    </div>
                    <div className="product-stock" style={{ color: stock.color }}>
                      {stock.text}
                    </div>
                    <div className="qty-row">
                      <button type="button" disabled={!entry} onClick={() => changeQty(p.id, -1)}>
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        className="qty-input"
                        aria-label={t("newOrder.qtyInputLabel")}
                        value={entry?.qty || 0}
                        disabled={swissMissing && !entry}
                        onChange={(e) => setQtyDirect(p.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                      <button type="button" disabled={swissMissing} onClick={() => changeQty(p.id, 1)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {renderCartButton({ position: "sticky", bottom: 14, marginTop: 18 })}
        </>
      )}

      {subview === "cart" && (
        <>
          <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => setSubview("browse")}>
            <ArrowLeft size={14} /> {t("newOrder.backToCatalogue")}
          </button>
          <h1 className="page-title">{t("newOrder.cartTitle", { name: account.name })}</h1>
          <p className="page-sub">{t("newOrder.cartSubtitle")}</p>

          {cartItems.length === 0 && <p className="empty-state">{t("newOrder.cartEmpty")}</p>}

          {Object.entries(byCategory).map(([cat, g]) => {
            const rate = discountRateFor(cat);
            const applied = discountApplied[cat] === true;
            return (
              <div className="cat-block panel" key={cat}>
                <div className="cat-head">
                  <h4>{t(`category.${cat}`)}</h4>
                  {rate > 0 && (
                    <div className="toggle" onClick={() => setDiscountApplied((d) => ({ ...d, [cat]: !applied }))}>
                      {t("newOrder.discountLabel", { pct: rate })}
                      <div className={`switch ${applied ? "on" : ""}`} />
                    </div>
                  )}
                </div>
                {g.items.map((i) => (
                  <div className="line-item" key={i.productId}>
                    <CartLineQty
                      qty={i.qty}
                      label={i.product.label}
                      onChange={(q) => setCartLineQty(i.productId, q)}
                      t={t}
                    />
                    <span style={{ flex: 1, minWidth: 120 }}>
                      {i.product.label} {i.isGift && <span className="offert-badge">{t("newOrder.giftLabel")}</span>}
                      {!isPrecommande && i.product.stockStatus === "REASSORT_PREVU" && (
                        <span className="offert-badge" style={{ marginLeft: 4 }}>
                          {t("newOrder.reliquatBadge")}
                          {i.product.restockDate ? ` (${shortDate(i.product.restockDate, locale)})` : ""}
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="toggle" onClick={() => toggleGift(i.productId)}>
                        {t("newOrder.giftLabel")} <div className={`switch gold ${i.isGift ? "on" : ""}`} />
                      </div>
                      <span>{i.isGift ? fmt(0) : fmt(i.unitPrice * i.qty)}</span>
                    </div>
                  </div>
                ))}
                <div className="cat-subtotal">
                  <span>
                    {applied && rate > 0
                      ? t("newOrder.subtotalDiscounted", { qty: g.items.reduce((s, i) => s + i.qty, 0) })
                      : t("newOrder.subtotalGross", { qty: g.items.reduce((s, i) => s + i.qty, 0) })}
                  </span>
                  <span>{fmt(applied ? g.subtotal * (1 - rate / 100) : g.subtotal)}</span>
                </div>
              </div>
            );
          })}

          {cartItems.length > 0 && (
            <div className="cat-block panel">
              <div className="cat-head">
                <h4>{t("newOrder.shippingSection")}</h4>
                <div className="toggle" onClick={() => setShippingOffered((v) => !v)}>
                  {t("newOrder.shippingOffer")} <div className={`switch gold ${shippingOffered ? "on" : ""}`} />
                </div>
              </div>
              <div className="line-item">
                <span>
                  {t("newOrder.shippingSection")} {shippingOffered && <span className="offert-badge">{t("newOrder.shippingOffered")}</span>}
                </span>
                <span>{shippingLabel}</span>
              </div>
              {shippingThreshold !== null && !shippingOffered && (
                <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                  {shippingAutoEligible
                    ? t("newOrder.shippingHintEligible", { amount: fmt(shippingThreshold) })
                    : t("newOrder.shippingHintMissing", {
                        amount: fmt(shippingThreshold),
                        remaining: fmt(Math.max(0, shippingThreshold - totalAmount)),
                      })}
                </p>
              )}
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="panel">
              <h3>{t("newOrder.totalsTitle")}</h3>
              <div className="task-row">
                <span>{t("newOrder.totalQty")}</span>
                <span>{t("newOrder.totalQtyValue", { qty: cartCount })}</span>
              </div>
              <div className="task-row">
                <span>{t("newOrder.totalAmount")}</span>
                <span>{fmt(totalAmount)}</span>
              </div>
              <div className="task-row">
                <span>{t("newOrder.totalShipping")}</span>
                <span>{shippingLabel}</span>
              </div>
              <div className="task-row" style={{ fontWeight: 800, borderTop: "1px dashed var(--line)", paddingTop: 8, marginTop: 4 }}>
                <span>{t("newOrder.totalOrder")}</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="panel">
              <h3>{t("newOrder.extraInfoTitle")}</h3>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  marginBottom: 12,
                  padding: "8px 10px",
                  background: isPrecommande ? "var(--gold-soft)" : "transparent",
                  borderRadius: 5,
                }}
              >
                <input type="checkbox" checked={isPrecommande} onChange={(e) => setIsPrecommande(e.target.checked)} />
                <span style={{ fontWeight: 600 }}>{t("newOrder.precommandeLabel")}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>— {t("newOrder.precommandeHint")}</span>
              </label>
              <div className="cc-field">
                <label>{t("newOrder.desiredDeliveryLabel")}</label>
                <input
                  type="date"
                  value={desiredDeliveryDate}
                  onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="cc-field">
                <label>{t("newOrder.noteLabel")}</label>
                <textarea placeholder={t("newOrder.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}

          {submitError && <p className="error-text">{submitError}</p>}

          {cartItems.length > 0 && shippingToDefine && !shippingOffered && (
            <p className="convert-warning" style={{ marginBottom: 10 }}>
              {t("newOrder.shippingToDefineWarning")}
            </p>
          )}

          {cartItems.length > 0 && (
            <>
              <div className="grand-total">
                <span>{t("newOrder.totalOrder")}</span>
                <span>{fmt(grandTotal)}</span>
              </div>
              <button className="btn primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? t("newOrder.submitting") : t("newOrder.submit")}
              </button>
            </>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
