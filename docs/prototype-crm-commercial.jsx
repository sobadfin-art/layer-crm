import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, Package, ShoppingCart, ClipboardCheck,
  Settings, MapPin, Globe, Plus, Minus, Search, FileDown,
  ArrowLeftRight, CircleDot, X, Map, Phone, Mail, Building2,
  History, ArrowLeft, Gift, Award, Route, Lock, Mic, CalendarDays, Bell, Check,
} from "lucide-react";
import * as XLSX from "xlsx";

/* ================= i18n ================= */

const STRINGS = {
  fr: {
    demo_note: "Aperçu démo — pas dans l'app réelle",
    role_rep: "Représentant", role_masterrep: "Master Rep", role_frontdesk: "Front desk", role_directeur: "Directeur commercial", role_admin: "Administrateur",
    nav_dashboard: "Tableau de bord", nav_crm: "Clients & prospects", nav_carte: "Carte & tournées",
    nav_catalogue: "Catalogue", nav_panier: "Commande en cours", nav_file: "File d'attente",
    nav_historique: "Historique", nav_equipe: "Équipe & territoires", nav_bestsellers: "Bestsellers",
    nav_config: "Configuration",
    btn_new_order: "Nouvelle commande", btn_new_account: "Nouveau prospect / client",
    btn_choose_client: "Choisir un client", btn_change_client: "changer de client",
    btn_send_frontdesk: "Envoyer au front desk", btn_create_order: "Créer une commande",
    btn_optimize: "Optimiser la tournée", btn_create_fiche: "Créer la fiche", btn_back: "Retour à la liste",
    hello: "Bonjour Camille", sub_dashboard: "Voici où tu en es aujourd'hui.",
    title_crm: "Clients & prospects", sub_crm: "Uniquement ton portefeuille — les autres représentants ne sont pas visibles ici.",
    title_carte: "Carte & tournées", sub_carte: "Sélectionne des points de vente puis optimise ta tournée.",
    title_catalogue: "Catalogue",
    label_company: "Raison sociale", label_billing_addr: "Adresse de facturation", label_delivery_addr: "Adresse de livraison",
    label_contact: "Contact principal", label_phone: "Téléphone", label_mobile: "Mobile", label_email: "Email", label_type: "Type",
    label_country: "Pays", label_typology: "Typologie de client", label_tax_id: "Identifiant fiscal",
    label_vat: "N° TVA intracom. / ID recargo", label_bank: "Coordonnées bancaires (SEPA)",
    period: "Période", rep_filter: "Représentant", typology_filter: "Typologie de client",
    all: "Toutes", offert: "Offert", stock_confidential: "Informations confidentielles",
  },
  en: {
    demo_note: "Demo preview — not in the real app",
    role_rep: "Sales rep", role_masterrep: "Master Rep", role_frontdesk: "Front desk", role_directeur: "Sales director", role_admin: "Administrator",
    nav_dashboard: "Dashboard", nav_crm: "Customers & prospects", nav_carte: "Map & routes",
    nav_catalogue: "Catalog", nav_panier: "Current order", nav_file: "Queue",
    nav_historique: "History", nav_equipe: "Team & territories", nav_bestsellers: "Bestsellers",
    nav_config: "Settings",
    btn_new_order: "New order", btn_new_account: "New prospect / customer",
    btn_choose_client: "Choose a customer", btn_change_client: "change customer",
    btn_send_frontdesk: "Send to front desk", btn_create_order: "Create an order",
    btn_optimize: "Optimize route", btn_create_fiche: "Create record", btn_back: "Back to list",
    hello: "Hello Camille", sub_dashboard: "Here's where you stand today.",
    title_crm: "Customers & prospects", sub_crm: "Your portfolio only — other reps aren't visible here.",
    title_carte: "Map & routes", sub_carte: "Select outlets, then optimize your route.",
    title_catalogue: "Catalog",
    label_company: "Company name", label_billing_addr: "Billing address", label_delivery_addr: "Delivery address",
    label_contact: "Main contact", label_phone: "Phone", label_mobile: "Mobile", label_email: "Email", label_type: "Type",
    label_country: "Country", label_typology: "Customer type", label_tax_id: "Tax / registration ID",
    label_vat: "VAT number / equivalent", label_bank: "Bank details (SEPA)",
    period: "Period", rep_filter: "Sales rep", typology_filter: "Customer type",
    all: "All", offert: "Free", stock_confidential: "Confidential information",
  },
  es: {
    demo_note: "Vista de demostración — no en la app real",
    role_rep: "Comercial", role_masterrep: "Master Rep", role_frontdesk: "Administración", role_directeur: "Director comercial", role_admin: "Administrador",
    nav_dashboard: "Panel", nav_crm: "Clientes y prospectos", nav_carte: "Mapa y rutas",
    nav_catalogue: "Catálogo", nav_panier: "Pedido en curso", nav_file: "Cola de pedidos",
    nav_historique: "Historial", nav_equipe: "Equipo y territorios", nav_bestsellers: "Más vendidos",
    nav_config: "Configuración",
    btn_new_order: "Nuevo pedido", btn_new_account: "Nuevo prospecto / cliente",
    btn_choose_client: "Elegir un cliente", btn_change_client: "cambiar de cliente",
    btn_send_frontdesk: "Enviar a administración", btn_create_order: "Crear un pedido",
    btn_optimize: "Optimizar ruta", btn_create_fiche: "Crear ficha", btn_back: "Volver a la lista",
    hello: "Hola Camille", sub_dashboard: "Así va tu día.",
    title_crm: "Clientes y prospectos", sub_crm: "Solo tu cartera — no ves a otros comerciales.",
    title_carte: "Mapa y rutas", sub_carte: "Selecciona puntos de venta y optimiza tu ruta.",
    title_catalogue: "Catálogo",
    label_company: "Razón social", label_billing_addr: "Dirección de facturación", label_delivery_addr: "Dirección de entrega",
    label_contact: "Contacto principal", label_phone: "Teléfono", label_mobile: "Móvil", label_email: "Correo", label_type: "Tipo",
    label_country: "País", label_typology: "Tipo de cliente", label_tax_id: "Identificador fiscal",
    label_vat: "NIF-IVA / recargo de equivalencia", label_bank: "Datos bancarios (SEPA)",
    period: "Periodo", rep_filter: "Comercial", typology_filter: "Tipo de cliente",
    all: "Todos", offert: "Gratis", stock_confidential: "Información confidencial",
  },
};

const TYPOLOGIES = [
  { code: "opticien", fr: "Opticien", en: "Optician", es: "Óptica" },
  { code: "surf_shop", fr: "Surf Shop", en: "Surf Shop", es: "Surf Shop" },
  { code: "fashion_store", fr: "Fashion Store", en: "Fashion Store", es: "Fashion Store" },
  { code: "skate_shop", fr: "Skate Shop", en: "Skate Shop", es: "Skate Shop" },
  { code: "ski_shop", fr: "Ski Shop", en: "Ski Shop", es: "Ski Shop" },
  { code: "concept_store", fr: "Concept Store", en: "Concept Store", es: "Concept Store" },
  { code: "uship", fr: "Uship", en: "Uship", es: "Uship" },
  { code: "bike_store", fr: "Bike Store", en: "Bike Store", es: "Bike Store" },
  { code: "key_account", fr: "Key Account", en: "Key Account", es: "Key Account" },
  { code: "distributor", fr: "Distributor", en: "Distributor", es: "Distributor" },
  { code: "other", fr: "Autre", en: "Other", es: "Otro" },
];

// Secteurs commerciaux réels (utilisés pour le pilotage des objectifs par le directeur),
// distincts de la typologie fine du client.
const SECTORS = ["Opticien", "Mode / Surf / Sport"];
function sectorFor(typologyCode) {
  return typologyCode === "opticien" ? "Opticien" : "Mode / Surf / Sport";
}

/* ================= Mock data ================= */

const REPS = [
  { id: "r1", name: "Camille Dubois", country: "France", region: "Île-de-France", ca: 84200, objectif: 100000, masterRep: "Julien Faure" },
  { id: "r2", name: "Marc Lefèvre", country: "France", region: "Auvergne-Rhône-Alpes", ca: 61500, objectif: 90000, masterRep: "Julien Faure" },
  { id: "r3", name: "Elena Ruiz", country: "Espagne", region: "Cataluña", ca: 73800, objectif: 80000, masterRep: null },
];

const MASTER_REPS = [
  { id: "mr1", name: "Julien Faure", country: "France", region: "Zone Sud-Ouest Europe" },
];

const INITIAL_ACCOUNTS = [
  { id: "a1", name: "Optique du Marais", type: "client", stage: "Gagné", wonDate: "2026-08-20", country: "France", typology: "opticien", ownerRep: "Camille Dubois", lastContact: "Il y a 3 jours",
    billing: { street: "12 rue des Rosiers", postalCode: "75004", city: "Paris" },
    delivery: { street: "12 rue des Rosiers", postalCode: "75004", city: "Paris" },
    contact: "Julie Bernard — Acheteuse", phoneCode: "+33", phone: "1 42 78 xx xx", mobileCode: "+33", mobile: "6 12 34 56 78", email: "j.bernard@optiquedumarais.fr",
    taxId: "552 xxx xxx 00012", vat: "FR xx 552xxxxxx", iban: "FR76 3000 4008 2800 0012 3456 721", sepaMandate: "Signé le 04/03/2026 — réf. MDT-2026-0142",
    lat: 48.857, lng: 2.360,
    history: [
      { date: "2026-09-12", label: "Commande envoyée", detail: "1 240 €" },
      { date: "2026-09-02", label: "Visite", detail: "Présentation collection Optique" },
      { date: "2026-06-14", label: "Commande envoyée", detail: "980 €" },
    ] },
  { id: "a2", name: "Vision Sud SARL", type: "prospect", stage: "Devis en cours", country: "France", typology: "opticien", ownerRep: "Camille Dubois", lastContact: "Hier",
    billing: { street: "8 avenue Jean Jaurès", postalCode: "31000", city: "Toulouse" },
    delivery: { street: "8 avenue Jean Jaurès", postalCode: "31000", city: "Toulouse" },
    contact: "Marc Sabatier — Dirigeant", phoneCode: "+33", phone: "5 61 xx xx xx", mobileCode: "+33", mobile: "6 45 12 78 90", email: "contact@visionsud.fr",
    taxId: "489 xxx xxx 00021", vat: "FR xx 489xxxxxx", iban: "FR76 1670 6050 0100 0089 9012 340", sepaMandate: "Non reçu",
    lat: 43.604, lng: 1.444,
    history: [{ date: "2026-09-11", label: "Devis envoyé", detail: "En attente de retour" }] },
  { id: "a3", name: "Óptica Barcelona", type: "prospect", stage: "RDV prévu", country: "Espagne", typology: "opticien", ownerRep: "Elena Ruiz", lastContact: "Il y a 5 jours",
    billing: { street: "Carrer de Provença 245", postalCode: "08036", city: "Barcelona" },
    delivery: { street: "Carrer de Provença 245", postalCode: "08036", city: "Barcelona" },
    contact: "Elena Ruiz — Acheteuse", phoneCode: "+34", phone: "93 xxx xx xx", mobileCode: "+34", mobile: "611 22 33 44", email: "compras@opticabarcelona.es",
    taxId: "B-xxxxxxxx", vat: "ESB xxxxxxxx (recargo de equivalencia)", iban: "ES91 2100 0418 4502 0005 1332", sepaMandate: "Non reçu",
    lat: 41.392, lng: 2.155,
    history: [{ date: "2026-09-07", label: "Premier contact", detail: "Intéressée par la collection Premium" }] },
  { id: "a4", name: "Lunetterie Centrale", type: "client", stage: "Gagné", wonDate: "2025-11-05", country: "France", typology: "opticien", ownerRep: "Camille Dubois", lastContact: "Il y a 1 semaine",
    billing: { street: "3 place Bellecour", postalCode: "69002", city: "Lyon" },
    delivery: { street: "20 rue de la Part-Dieu (entrepôt)", postalCode: "69003", city: "Lyon" },
    contact: "Sophie Marin — Responsable achats", phoneCode: "+33", phone: "4 78 xx xx xx", mobileCode: "+33", mobile: "7 89 01 23 45", email: "s.marin@lunetteriecentrale.fr",
    taxId: "398 xxx xxx 00045", vat: "FR xx 398xxxxxx", iban: "FR76 3000 3021 3000 0225 5744 456", sepaMandate: "Signé le 18/11/2025 — réf. MDT-2025-0871",
    lat: 45.758, lng: 4.832,
    history: [{ date: "2026-09-05", label: "Commande envoyée", detail: "2 180 €" }] },
  { id: "a5", name: "Mirall Visió", type: "prospect", stage: "Contacté", country: "Espagne", typology: "concept_store", ownerRep: "Elena Ruiz", lastContact: "Aujourd'hui",
    billing: { street: "Passeig de Gràcia 88", postalCode: "08008", city: "Barcelona" },
    delivery: { street: "Passeig de Gràcia 88", postalCode: "08008", city: "Barcelona" },
    contact: "Jordi Puig — Gérant", phoneCode: "+34", phone: "93 xxx xx xx", mobileCode: "+34", mobile: "699 88 77 66", email: "info@mirallvisio.es",
    taxId: "B-xxxxxxxx", vat: "ESB xxxxxxxx", iban: "ES91 0049 1500 0512 3456 7892", sepaMandate: "Non reçu",
    lat: 41.395, lng: 2.162,
    history: [{ date: "2026-09-12", label: "Appel téléphonique", detail: "Prise de rendez-vous prévue" }] },
];

const PIPELINE = ["Nouveau", "Contacté", "RDV prévu", "Devis en cours", "Négociation", "Gagné", "Perdu"];

const CATEGORIES = ["Premium", "Classic", "Optics", "Access", "Display", "Merch", "Goggles", "Kids"];

const STOCK_STATUSES = ["En stock", "Rupture", "Réassort prévu"];
const PRODUCT_STATUSES = ["Nouveau", "Actif", "Discontinué"];

const INITIAL_CATALOG = [
  { id: "mknf03-crst-tort-grn", ref: "MKNF03-CRST-TORT-GRN", label: "MILTON (CRST-TORT-GRN)", model: "MILTON", color: "CRST-TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "Réassort prévu", restockDate: "2026-10-15", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf03-smk-gry", ref: "MKNF03-SMK-GRY", label: "MILTON (SMK-GRY)", model: "MILTON", color: "SMK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng04-aqua-brw", ref: "MKNG04-AQUA-BRW", label: "SNAKE (AQUA-BRW)", model: "SNAKE", color: "AQUA-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "Réassort prévu", restockDate: "2026-11-02", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf02-crst-grn", ref: "MKNF02-CRST-GRN", label: "MONROE (CRST-GRN)", model: "MONROE", color: "CRST-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf02-glsnd-ggry", ref: "MKNF02-GLSND-GGRY", label: "MONROE (GLSND-GGRY)", model: "MONROE", color: "GLSND-GGRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng09-sepia-brw", ref: "MKNG09-SEPIA-BRW", label: "OTIS (SEPIA-BRW)", model: "OTIS", color: "SEPIA-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng09-crst-tort-gblu", ref: "MKNG09-CRST-TORT-GBL", label: "OTIS (CRST-TORT-GBLU)", model: "OTIS", color: "CRST-TORT-GBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng09-crst-tort-grn", ref: "MKNG09-CRST-TORT-GRN", label: "OTIS (CRST-TORT-GRN)", model: "OTIS", color: "CRST-TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf01-olv-grn", ref: "MKNF01-OLV-GRN", label: "HANK (OLV-GRN)", model: "HANK", color: "OLV-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf01-blk-tort-gry", ref: "MKNF01-BLK-TORT-GRY", label: "HANK (BLK-TORT-GRY)", model: "HANK", color: "BLK-TORT-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknf01-blu-gry", ref: "MKNF01-BLU-GRY", label: "HANK (BLU-GRY)", model: "HANK", color: "BLU-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh03-blu-gry", ref: "MKNH03-BLU-GRY", label: "BIGDUDE (BLU-GRY)", model: "BIGDUDE", color: "BLU-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh03-olv-tort-grn", ref: "MKNH03-OLV-TORT-GRN", label: "BIGDUDE (OLV-TORT-GRN)", model: "BIGDUDE", color: "OLV-TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj14-blk-wd-gry", ref: "MKNJ14-BLK-WD-GRY", label: "GREENWOOD (BLK-WD-GRY)", model: "GREENWOOD", color: "BLK-WD-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5104-superlarge_default/green-wood.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj14-crst-wd-grn", ref: "MKNJ14-CRST-WD-GRN", label: "GREENWOOD (CRST-WD-GRN)", model: "GREENWOOD", color: "CRST-WD-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5104-superlarge_default/green-wood.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj14-tort-wd-grn", ref: "MKNJ14-TORT-WD-GRN", label: "GREENWOOD (TORT-WD-GRN)", model: "GREENWOOD", color: "TORT-WD-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5104-superlarge_default/green-wood.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj14-grn-wd-grn", ref: "MKNJ14-GRN-WD-GRN", label: "GREENWOOD (GRN-WD-GRN)", model: "GREENWOOD", color: "GRN-WD-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5104-superlarge_default/green-wood.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj15-mst-wd-grn", ref: "MKNJ15-MST-WD-GRN", label: "KRAFTER (MST-WD-GRN)", model: "KRAFTER", color: "MST-WD-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj15-smk-wd-gry", ref: "MKNJ15-SMK-WD-GRY", label: "KRAFTER (SMK-WD-GRY)", model: "KRAFTER", color: "SMK-WD-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj15-tort-crk-brw", ref: "MKNJ15-TORT-CRK-BRW", label: "KRAFTER (TORT-CRK-BRW)", model: "KRAFTER", color: "TORT-CRK-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj13-blk-wd-gry", ref: "MKNJ13-BLK-WD-GRY", label: "WOODY (BLK-WD-GRY)", model: "WOODY", color: "BLK-WD-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5458-superlarge_default/woody.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj13-rwd-gry", ref: "MKNJ13-RWD-GRY", label: "WOODY (RWD-GRY)", model: "WOODY", color: "RWD-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5458-superlarge_default/woody.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj13-kki-wd-brw", ref: "MKNJ13-KKI-WD-BRW", label: "WOODY (KKI-WD-BRW)", model: "WOODY", color: "KKI-WD-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/5458-superlarge_default/woody.jpg", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj12-blk-blk", ref: "MKNJ12-BLK-BLK", label: "JASON (BLK-BLK)", model: "JASON", color: "BLK-BLK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj12-gld-grn", ref: "MKNJ12-GLD-GRN", label: "JASON (GLD-GRN)", model: "JASON", color: "GLD-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd42-crst-tort-grn", ref: "MKND42-CRST-TORT-GRN", label: "LEON (CRST-TORT-GRN)", model: "LEON", color: "CRST-TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd42-champ-grn", ref: "MKND42-CHAMP-GRN", label: "LEON (CHAMP-GRN)", model: "LEON", color: "CHAMP-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd42-crst-pnk-gry", ref: "MKND42-CRST-PNK-GRY", label: "LEON (CRST-PNK-GRY)", model: "LEON", color: "CRST-PNK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh15-kki-grn", ref: "MKNH15-KKI-GRN", label: "LARGELEON (KKI-GRN)", model: "LARGELEON", color: "KKI-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj05-blk-gry", ref: "MKNJ05-BLK-GRY", label: "QUINCY (BLK-GRY)", model: "QUINCY", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj05-nvy-brw", ref: "MKNJ05-NVY-BRW", label: "QUINCY (NVY-BRW)", model: "QUINCY", color: "NVY-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj05-kki-brw", ref: "MKNJ05-KKI-BRW", label: "QUINCY (KKI-BRW)", model: "QUINCY", color: "KKI-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni12-blk-tort-gry", ref: "MKNI12-BLK-TORT-GRY", label: "KARLTON (BLK-TORT-GRY)", model: "KARLTON", color: "BLK-TORT-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni12-smk-ggry", ref: "MKNI12-SMK-GGRY", label: "KARLTON (SMK-GGRY)", model: "KARLTON", color: "SMK-GGRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng08-brw-gorg", ref: "MKNG08-BRW-GORG", label: "MILES (BRW-GORG)", model: "MILES", color: "BRW-GORG", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng06-snd-gbrw", ref: "MKNG06-SND-GBRW", label: "MONIQUE (SND-GBRW)", model: "MONIQUE", color: "SND-GBRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng06-tort-gbrw", ref: "MKNG06-TORT-GBRW", label: "MONIQUE (TORT-GBRW)", model: "MONIQUE", color: "TORT-GBRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng06-pnk-tort-gbrw", ref: "MKNG06-PNK-TORT-GBRW", label: "MONIQUE (PNK-TORT-GBRW)", model: "MONIQUE", color: "PNK-TORT-GBRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng06-grn-gorg", ref: "MKNG06-GRN-GORG", label: "MONIQUE (GRN-GORG)", model: "MONIQUE", color: "GRN-GORG", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng12-smk-gry", ref: "MKNG12-SMK-GRY", label: "ZENITH (SMK-GRY)", model: "ZENITH", color: "SMK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng12-tort-grn", ref: "MKNG12-TORT-GRN", label: "ZENITH (TORT-GRN)", model: "ZENITH", color: "TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng12-blu-gblu", ref: "MKNG12-BLU-GBLU", label: "ZENITH (BLU-GBLU)", model: "ZENITH", color: "BLU-GBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng12-blk-gry", ref: "MKNG12-BLK-GRY", label: "ZENITH (BLK-GRY)", model: "ZENITH", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng12-ylw-grn", ref: "MKNG12-YLW-GRN", label: "ZENITH (YLW-GRN)", model: "ZENITH", color: "YLW-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni07-blk-tort-gry", ref: "MKNI07-BLK-TORT-GRY", label: "IVY (BLK-TORT-GRY)", model: "IVY", color: "BLK-TORT-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni07-pnk-gpnk", ref: "MKNI07-PNK-GPNK", label: "IVY (PNK-GPNK)", model: "IVY", color: "PNK-GPNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni07-crm-brw", ref: "MKNI07-CRM-BRW", label: "IVY (CRM-BRW)", model: "IVY", color: "CRM-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni07-grn-grn", ref: "MKNI07-GRN-GRN", label: "IVY (GRN-GRN)", model: "IVY", color: "GRN-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni22-blk-tort-gry", ref: "MKNI22-BLK-TORT-GRY", label: "APRIL (BLK-TORT-GRY)", model: "APRIL", color: "BLK-TORT-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni22-smk-gpur", ref: "MKNI22-SMK-GPUR", label: "APRIL (SMK-GPUR)", model: "APRIL", color: "SMK-GPUR", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni22-org-grn", ref: "MKNI22-ORG-GRN", label: "APRIL (ORG-GRN)", model: "APRIL", color: "ORG-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni22-nvy-gblu", ref: "MKNI22-NVY-GBLU", label: "APRIL (NVY-GBLU)", model: "APRIL", color: "NVY-GBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni22-org-gbrn", ref: "MKNI22-ORG-GBRN", label: "APRIL (ORG-GBRN)", model: "APRIL", color: "ORG-GBRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj01-chmp-grn", ref: "MKNJ01-CHMP-GRN", label: "ANDY (CHMP-GRN)", model: "ANDY", color: "CHMP-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj01-tort-gblu", ref: "MKNJ01-TORT-GBLU", label: "ANDY (TORT-GBLU)", model: "ANDY", color: "TORT-GBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni09-crst-ggry", ref: "MKNI09-CRST-GGRY", label: "DANE (CRST-GGRY)", model: "DANE", color: "CRST-GGRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni09-kki-brw", ref: "MKNI09-KKI-BRW", label: "DANE (KKI-BRW)", model: "DANE", color: "KKI-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni09-blk-blu", ref: "MKNI09-BLK-BLU", label: "DANE II (BLK-BLU)", model: "DANE II", color: "BLK-BLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni09-org-gorg", ref: "MKNI09-ORG-GORG", label: "DANE II (ORG-GORG)", model: "DANE II", color: "ORG-GORG", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk07-blk-gry", ref: "MKNK07-BLK-GRY", label: "JONES (BLK-GRY)", model: "JONES", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk07-kki-ggrn", ref: "MKNK07-KKI-GGRN", label: "JONES (KKI-GGRN)", model: "JONES", color: "KKI-GGRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk07-mst-grn", ref: "MKNK07-MST-GRN", label: "JONES (MST-GRN)", model: "JONES", color: "MST-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk05-smk-grn", ref: "MKNK05-SMK-GRN", label: "TOMMY (SMK-GRN)", model: "TOMMY", color: "SMK-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk05-org-gbrw", ref: "MKNK05-ORG-GBRW", label: "TOMMY (ORG-GBRW)", model: "TOMMY", color: "ORG-GBRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk05-hav-org", ref: "MKNK05-HAV-ORG", label: "TOMMY (HAV-ORG)", model: "TOMMY", color: "HAV-ORG", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk05-blk-grn", ref: "MKNK05-BLK-GRN", label: "TOMMY (BLK-GRN)", model: "TOMMY", color: "BLK-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk33-crst-brw", ref: "MKNK33-CRST-BRW", label: "LEONNIE (CRST-BRW)", model: "LEONNIE", color: "CRST-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk33-blu-gry", ref: "MKNK33-BLU-GRY", label: "LEONNIE (BLU-GRY)", model: "LEONNIE", color: "BLU-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk33-mst-grn", ref: "MKNK33-MST-GRN", label: "LEONNIE (MST-GRN)", model: "LEONNIE", color: "MST-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk06-blk-gry", ref: "MKNK06-BLK-GRY", label: "ABBYS (BLK-GRY)", model: "ABBYS", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk06-sepia-brw", ref: "MKNK06-SEPIA-BRW", label: "ABBYS (SEPIA-BRW)", model: "ABBYS", color: "SEPIA-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk06-gpnk-gpnk", ref: "MKNK06-GPNK-GPNK", label: "ABBYS (GPNK-GPNK)", model: "ABBYS", color: "GPNK-GPNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk15-crst-ggry", ref: "MKNK15-CRST-GGRY", label: "MILO (CRST-GGRY)", model: "MILO", color: "CRST-GGRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk09-blk-pur", ref: "MKNK09-BLK-PUR", label: "SHARPER (BLK-PUR)", model: "SHARPER", color: "BLK-PUR", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk09-tort-ylw", ref: "MKNK09-TORT-YLW", label: "SHARPER (TORT-YLW)", model: "SHARPER", color: "TORT-YLW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk36-tort-grn", ref: "MKNK36-TORT-GRN", label: "KALLAN (TORT-GRN)", model: "KALLAN", color: "TORT-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk35-smk-brw", ref: "MKNK35-SMK-BRW", label: "FILTON (SMK-BRW)", model: "FILTON", color: "SMK-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk35-dgrn-gry", ref: "MKNK35-DGRN-GRY", label: "FILTON (DGRN-GRY)", model: "FILTON", color: "DGRN-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk34-blk-gry", ref: "MKNK34-BLK-GRY", label: "DARCY (BLK-GRY)", model: "DARCY", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk34-tort-brw", ref: "MKNK34-TORT-BRW", label: "DARCY (TORT-BRW)", model: "DARCY", color: "TORT-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-blk-gry", ref: "MKNG07-BLK-GRY", label: "WALTER (BLK-GRY)", model: "WALTER", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-snd-blk-gslv", ref: "MKNG07-SND-BLK-GSLV", label: "WALTER (SND-BLK-GSLV)", model: "WALTER", color: "SND-BLK-GSLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-snd-red-gslv", ref: "MKNG07-SND-RED-GSLV", label: "WALTER (SND-RED-GSLV)", model: "WALTER", color: "SND-RED-GSLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-kki-blk-fgrn", ref: "MKNG07-KKI-BLK-FGRN", label: "WALTER (KKI-BLK-FGRN)", model: "WALTER", color: "KKI-BLK-FGRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-cml-brw", ref: "MKNG07-CML-BRW", label: "WALTER (CML-BRW)", model: "WALTER", color: "CML-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkng07-sage-sil", ref: "MKNG07-SAGE-SIL", label: "WALTER (SAGE-SIL)", model: "WALTER", color: "SAGE-SIL", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-blk-blk-cop", ref: "MKNH16-BLK-BLK-COP", label: "HAWKINSVINTAGE (BLK-BLK-COP)", model: "HAWKINSVINTAGE", color: "BLK-BLK-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-gry-pur-fblu", ref: "MKNH16-GRY-PUR-FBLU", label: "HAWKINSVINTAGE (GRY-PUR-FBLU)", model: "HAWKINSVINTAGE", color: "GRY-PUR-FBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-snd-snd-gslv", ref: "MKNH16-SND-SND-GSLV", label: "HAWKINSVINTAGE (SND-SND-GSLV)", model: "HAWKINSVINTAGE", color: "SND-SND-GSLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-brw-brw-brw", ref: "MKNH16-BRW-BRW-BRW", label: "HAWKINSVINTAGE (BRW-BRW-BRW)", model: "HAWKINSVINTAGE", color: "BRW-BRW-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-wht-pur-fpnk", ref: "MKNH16-WHT-PUR-FPNK", label: "HAWKINSVINTAGE (WHT-PUR-FPNK)", model: "HAWKINSVINTAGE", color: "WHT-PUR-FPNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-smk-blk-fgrn", ref: "MKNH16-SMK-BLK-FGRN", label: "HAWKINSVINTAGE (SMK-BLK-FGRN)", model: "HAWKINSVINTAGE", color: "SMK-BLK-FGRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh16-tort-kki-grn", ref: "MKNH16-TORT-KKI-GRN", label: "HAWKINSVINTAGE (TORT-KKI-GRN)", model: "HAWKINSVINTAGE", color: "TORT-KKI-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-tort-kki-fred", ref: "MKNE30-TORT-KKI-FRED", label: "HAWKINS (TORT-KKI-FRED)", model: "HAWKINS", color: "TORT-KKI-FRED", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-smk-pur-fpnk", ref: "MKNE30-SMK-PUR-FPNK", label: "HAWKINS (SMK-PUR-FPNK)", model: "HAWKINS", color: "SMK-PUR-FPNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-blk-grn-cop", ref: "MKNE30-BLK-GRN-COP", label: "HAWKINS (BLK-GRN-COP)", model: "HAWKINS", color: "BLK-GRN-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-packh", ref: "MKNE30-PACKH", label: "HAWKINS (Pack Helias)", model: "HAWKINS", color: "Pack Helias", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 38.7, priceExport: null, priceCH: null, rrp: 89, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-gry-cop", ref: "MKNE30-GRY-COP", label: "HAWKINS (GRY-COP)", model: "HAWKINS", color: "GRY-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-cml-brw", ref: "MKNE30-CML-BRW", label: "HAWKINS (CML-BRW)", model: "HAWKINS", color: "CML-BRW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-tort-blk-grn", ref: "MKNE30-TORT-BLK-GRN", label: "HAWKINS (TORT-BLK-GRN)", model: "HAWKINS", color: "TORT-BLK-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne30-blk-blk-gry", ref: "MKNE30-BLK-BLK-GRY", label: "HAWKINS (BLK-BLK-GRY)", model: "HAWKINS", color: "BLK-BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk03-blk-grn", ref: "MKNK03-BLK-GRN", label: "GERRY (BLK-GRN)", model: "GERRY", color: "BLK-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk02-pur-pnk", ref: "MKNK02-PUR-PNK", label: "KUTBAK (PUR-PNK)", model: "KUTBAK", color: "PUR-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk02-blu-grn", ref: "MKNK02-BLU-GRN", label: "KUTBAK (BLU-GRN)", model: "KUTBAK", color: "BLU-GRN", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk02-slv-slv", ref: "MKNK02-SLV-SLV", label: "KUTBAK (SLV-SLV)", model: "KUTBAK", color: "SLV-SLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk01-blk-sil", ref: "MKNK01-BLK-SIL", label: "BRUCE (BLK-SIL)", model: "BRUCE", color: "BLK-SIL", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk01-kki-cop", ref: "MKNK01-KKI-COP", label: "BRUCE (KKI-COP)", model: "BRUCE", color: "KKI-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk01-smk-pnk", ref: "MKNK01-SMK-PNK", label: "BRUCE (SMK-PNK)", model: "BRUCE", color: "SMK-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk01-wht-gcop", ref: "MKNK01-WHT-GCOP", label: "BRUCE (WHT-GCOP)", model: "BRUCE", color: "WHT-GCOP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk26-grn-gry", ref: "MKNK26-GRN-GRY", label: "KIMO (GRN-GRY)", model: "KIMO", color: "GRN-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 21.3, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk26-blk-gry", ref: "MKNK26-BLK-GRY", label: "KIMO (BLK-GRY)", model: "KIMO", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 21.3, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk26-pnk-fblu", ref: "MKNK26-PNK-FBLU", label: "KIMO (PNK-FBLU)", model: "KIMO", color: "PNK-FBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 21.3, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk26-mst-slv", ref: "MKNK26-MST-SLV", label: "KIMO (MST-SLV)", model: "KIMO", color: "MST-SLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 21.3, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk30-crst-ylw", ref: "MKNK30-CRST-YLW", label: "KELI (CRST-YLW)", model: "KELI", color: "CRST-YLW", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk30-snd-cop", ref: "MKNK30-SND-COP", label: "KELI (SND-COP)", model: "KELI", color: "SND-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk30-nvy-blu", ref: "MKNK30-NVY-BLU", label: "KELI (NVY-BLU)", model: "KELI", color: "NVY-BLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk31-snd-cop", ref: "MKNK31-SND-COP", label: "OLINA (SND-COP)", model: "OLINA", color: "SND-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk31-smk-pnk", ref: "MKNK31-SMK-PNK", label: "OLINA (SMK-PNK)", model: "OLINA", color: "SMK-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk31-blk-sil", ref: "MKNK31-BLK-SIL", label: "OLINA (BLK-SIL)", model: "OLINA", color: "BLK-SIL", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk29-pur-fblu", ref: "MKNK29-PUR-FBLU", label: "MOANA (PUR-FBLU)", model: "MOANA", color: "PUR-FBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk29-pnk-mlt", ref: "MKNK29-PNK-MLT", label: "MOANA (PNK-MLT)", model: "MOANA", color: "PNK-MLT", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk29-blk-gry", ref: "MKNK29-BLK-GRY", label: "MOANA (BLK-GRY)", model: "MOANA", color: "BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh19-blk-blk-gry", ref: "MKNH19-BLK-BLK-GRY", label: "SANTO (BLK-BLK-GRY)", model: "SANTO", color: "BLK-BLK-GRY", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh19-gry-blk-red", ref: "MKNH19-GRY-BLK-RED", label: "SANTO (GRY-BLK-RED)", model: "SANTO", color: "GRY-BLK-RED", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh19-nvy-blu-blu", ref: "MKNH19-NVY-BLU-BLU", label: "SANTO (NVY-BLU-BLU)", model: "SANTO", color: "NVY-BLU-BLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 34.35, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh19-sage-blk-cop", ref: "MKNH19-SAGE-BLK-COP", label: "SANTO (SAGE-BLK-COP)", model: "SANTO", color: "SAGE-BLK-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-blk-pcm", ref: "MKNH21-BLK-PCM", label: "KURTISS-DH (BLK-PCM)", model: "KURTISS-DH", color: "BLK-PCM", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 60.43, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-blk-red", ref: "MKNH21-BLK-RED", label: "KURTISS-DH (BLK-RED)", model: "KURTISS-DH", color: "BLK-RED", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 43.04, priceExport: null, priceCH: null, rrp: 99, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-smk-blu", ref: "MKNH21-SMK-BLU", label: "KURTISS-DH (SMK-BLU)", model: "KURTISS-DH", color: "SMK-BLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 43.04, priceExport: null, priceCH: null, rrp: 99, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-blk-pnk", ref: "MKNH21-BLK-PNK", label: "KURTISS-DH (BLK-PNK)", model: "KURTISS-DH", color: "BLK-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 56.09, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-crm-gry-pnk", ref: "MKNH21-CRM-GRY-PNK", label: "KURTISS-DH (CRM-GRY-PNK)", model: "KURTISS-DH", color: "CRM-GRY-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 51.74, priceExport: null, priceCH: null, rrp: 119, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh21-kki-cop", ref: "MKNH21-KKI-COP", label: "KURTISS-DH (KKI-COP)", model: "KURTISS-DH", color: "KKI-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 51.74, priceExport: null, priceCH: null, rrp: 119, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh22-blk-slv", ref: "MKNH22-BLK-SLV", label: "STRATO-DH (BLK-SLV)", model: "STRATO-DH", color: "BLK-SLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh22-pur-fblu", ref: "MKNH22-PUR-FBLU", label: "STRATO-DH (PUR-FBLU)", model: "STRATO-DH", color: "PUR-FBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh22-wht-mlt", ref: "MKNH22-WHT-MLT", label: "STRATO-DH (WHT-MLT)", model: "STRATO-DH", color: "WHT-MLT", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-blk-pslv", ref: "MKNE64-BLK-PSLV", label: "ROCKETT (BLK-PSLV)", model: "ROCKETT", color: "BLK-PSLV", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-mnt-pnk", ref: "MKNE64-MNT-PNK", label: "ROCKETT (MNT-PNK)", model: "ROCKETT", color: "MNT-PNK", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-pnk-pur", ref: "MKNE64-PNK-PUR", label: "ROCKETT (PNK-PUR)", model: "ROCKETT", color: "PNK-PUR", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-whtp-fcol", ref: "MKNE64-WHTP-FCOL", label: "ROCKETT (WHTP-FCOL)", model: "ROCKETT", color: "WHTP-FCOL", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-blu-cop", ref: "MKNE64-BLU-COP", label: "ROCKETT (BLU-COP)", model: "ROCKETT", color: "BLU-COP", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne64-nvy-fblu", ref: "MKNE64-NVY-FBLU", label: "ROCKETT (NVY-FBLU)", model: "ROCKETT", color: "NVY-FBLU", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 30.0, priceExport: null, priceCH: null, rrp: 69, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh20-mint-red", ref: "MKNH20-MINT-RED", label: "MINIROCKETT (MINT-RED)", model: "MINIROCKETT", color: "MINT-RED", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 22.27, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh20-pur-mnt-blu", ref: "MKNH20-PUR-MNT-BLU", label: "MINIROCKETT (PUR-MNT-BLU)", model: "MINIROCKETT", color: "PUR-MNT-BLU", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 22.27, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh20-aqua-pnk", ref: "MKNH20-AQUA-PNK", label: "MINIROCKETT (AQUA-PNK)", model: "MINIROCKETT", color: "AQUA-PNK", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 23.27, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh20-pnk-pnk", ref: "MKNH20-PNK-PNK", label: "MINIROCKETT (PNK-PNK)", model: "MINIROCKETT", color: "PNK-PNK", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 22.27, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknh20-blu-pgrn", ref: "MKNH20-BLU-PGRN", label: "MINIROCKETT (NVY-FBLU)", model: "MINIROCKETT", color: "NVY-FBLU", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 22.27, priceExport: null, priceCH: null, rrp: 49, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni01-blu-gry", ref: "MKNI01-BLU-GRY", label: "MINIROB (BLU-GRY)", model: "MINIROB", color: "BLU-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni01-crl-pnk-gry", ref: "MKNI01-CRL-PNK-GRY", label: "MINIROB (CRL-PNK-GRY)", model: "MINIROB", color: "CRL-PNK-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni01-yel-grn", ref: "MKNI01-YEL-GRN", label: "MINIROB (YEL-GRN)", model: "MINIROB", color: "YEL-GRN", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd44-glsnd-ggry", ref: "MKND44-GLSND-GGRY", label: "CHEEKY (GLSND-GGRY)", model: "CHEEKY", color: "GLSND-GGRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd44-pnk-brw", ref: "MKND44-PNK-BRW", label: "CHEEKY (PNK-BRW)", model: "CHEEKY", color: "PNK-BRW", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni05-pur-mnt-gry", ref: "MKNI05-PUR-MNT-GRY", label: "NZOOII (PUR-MNT-GRY)", model: "NZOOII", color: "PUR-MNT-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni05-nvy-gry", ref: "MKNI05-NVY-GRY", label: "NZOOII (NVY-GRY)", model: "NZOOII", color: "NVY-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni05-kki-brw", ref: "MKNI05-KKI-BRW", label: "NZOOII (KKI-BRW)", model: "NZOOII", color: "KKI-BRW", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd45-blue-gry", ref: "MKND45-BLUE-GRY", label: "ROUNDY (BLUE-GRY)", model: "ROUNDY", color: "BLUE-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd45-org-org-gry", ref: "MKND45-ORG-ORG-GRY", label: "ROUNDY (ORG-ORG-GRY)", model: "ROUNDY", color: "ORG-ORG-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknd45-grn-lime-gry", ref: "MKND45-GRN-LIME-GRY", label: "ROUNDY (GRN-LIME-GRY)", model: "ROUNDY", color: "GRN-LIME-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk23-ylw-gry", ref: "MKNK23-YLW-GRY", label: "PIOU II (YLW-GRY)", model: "PIOU II", color: "YLW-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk23-pnk-gry", ref: "MKNK23-PNK-GRY", label: "PIOU II (PNK-GRY)", model: "PIOU II", color: "PNK-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk23-blu-gry", ref: "MKNK23-BLU-GRY", label: "PIOU II (BLU-GRY)", model: "PIOU II", color: "BLU-GRY", category: "Kids", collection: "KIDS", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 15.91, priceExport: null, priceCH: null, rrp: 35, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni06-pack", ref: "MKNI06-PACK", label: "BIG BREND", model: "BIG BREND", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "https://www.mokenvision.com/4212-superlarge_default/the-brend.jpg", priceFR: 161.72, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkne50-packii", ref: "MKNE50-PACKII", label: "WERRIS", model: "WERRIS", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 161.72, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mkni02-pack", ref: "MKNI02-PACK", label: "MUDDY", model: "MUDDY", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 161.72, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknj16-pack", ref: "MKNJ16-PACK", label: "ROVERII", model: "ROVERII", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 161.74, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk22-pack", ref: "MKNK22-pack", label: "MAIKAN", model: "MAIKAN", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 161.72, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk22-tort-fred", ref: "MKNK22-TORT-FRED", label: "3 Polarized", model: "3 Polarized", color: "", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: null, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk21-pack", ref: "MKNK21-pack", label: "IVIK", model: "IVIK", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 161.72, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknk21-tort-grn", ref: "MKNK21-TORT-GRN", label: "3 Polarized", model: "3 Polarized", color: "", category: "Premium", collection: "PremiumSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: null, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknc13-packii", ref: "MKNC13-PACKII", label: "SKYFOIL", model: "SKYFOIL", color: "", category: "Classic", collection: "ClassicSeries", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 179.12, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn05-clip", ref: "AMKN05-CLIP", label: "COLOREDCORDCLIP", model: "COLOREDCORDCLIP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 24.24, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn06-hoop", ref: "AMKN06-HOOP", label: "COLOREDCORDHOOP", model: "COLOREDCORDHOOP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 24.24, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn07-clip", ref: "AMKN07-CLIP", label: "CORDBLACKCLIP", model: "CORDBLACKCLIP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 12.12, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn07-hoop", ref: "AMKN07-HOOP", label: "CORDBLACKHOOP", model: "CORDBLACKHOOP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 12.12, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn11-pack", ref: "AMKN11-PACK", label: "COLOREDCORDCLIP", model: "COLOREDCORDCLIP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 17.37, priceExport: null, priceCH: null, rrp: 9.99, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn12-pack", ref: "AMKN12-PACK", label: "COLOREDCORDCLIP", model: "COLOREDCORDCLIP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 24.24, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn13-pack", ref: "AMKN13-PACK", label: "COLOREDCORDCLIP", model: "COLOREDCORDCLIP", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 12.12, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn09-pack", ref: "AMKN09-PACK", label: "IMPLEMENTATIONPACK", model: "IMPLEMENTATIONPACK", color: "", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 121.2, priceExport: null, priceCH: null, rrp: 7, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "c-disp01-pr", ref: "C.DISP01-PR", label: "PREMIUMWOODENDISPLAY (WOODEN15SLOTSDISPLAY)", model: "PREMIUMWOODENDISPLAY", color: "WOODEN15SLOTSDISPLAY", category: "Display", collection: "Display", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 60.0, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "c-disp03-pr", ref: "C.DISP03-PR", label: "LARGECITYDISPLAY (72SLOTSDISPLAY)", model: "LARGECITYDISPLAY", color: "72SLOTSDISPLAY", category: "Display", collection: "Display", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 350.0, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "c-disp02-pr", ref: "C.DISP02-PR", label: "MEDIUMCITYDISPLAY", model: "MEDIUMCITYDISPLAY", color: "", category: "Display", collection: "Display", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 275.0, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "dispsun2", ref: "DISPSUN2", label: "WOODENFLOORDISPLAY (32SLOTSWOODENSTAND)", model: "WOODENFLOORDISPLAY", color: "32SLOTSWOODENSTAND", category: "Display", collection: "Display", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 275.0, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "a-disp03", ref: "A-DISP03", label: "LENS CLEANER KIT (LENS CLEANER KIT)", model: "LENS CLEANER KIT", color: "LENS CLEANER KIT", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 4.99, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "amkn10-mask", ref: "AMKN10-MASK", label: "Face Mask (MAGIC MOUNTAIN MASK)", model: "Face Mask", color: "MAGIC MOUNTAIN MASK", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 11.35, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "clip-optique-olina", ref: "CLIP-OPTIQUE-OLINA", label: "Optical Clip (Model Olina)", model: "Optical Clip", color: "Model Olina", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 6.48, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "clip-optique-straku", ref: "CLIP-OPTIQUE-STRAKU", label: "Optical Clip (Modeel Strato & Kurtiss)", model: "Optical Clip", color: "Modeel Strato & Kurtiss", category: "Access", collection: "Accessories", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 6.48, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "plvst-pack", ref: "PLVST-PACK", label: "Starter Pack", model: "Starter Pack", color: "", category: "Merch", collection: "Merchandising", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: null, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "plvsol", ref: "PLVSOL", label: "POP Solaire (PLV Solaire)", model: "POP Solaire", color: "PLV Solaire", category: "Merch", collection: "Merchandising", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: null, priceExport: null, priceCH: null, rrp: 0, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn01-blk-slv", ref: "GKN01-BLK-SLV", label: "ONE (BLK-SLV)", model: "ONE", color: "BLK-SLV", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 63.18, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn01-blu-gld", ref: "GKN01-BLU-GLD", label: "ONE (BLU-GLD)", model: "ONE", color: "BLU-GLD", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 63.18, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn01-grn-red", ref: "GKN01-GRN-RED", label: "ONE (GRN-RED)", model: "ONE", color: "GRN-RED", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 63.18, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn01-purp-gry", ref: "GKN01-PURP-GRY", label: "ONE (PURP-GRY)", model: "ONE", color: "PURP-GRY", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 63.18, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn02-blu-slv", ref: "GKN02-BLU-SLV", label: "TWO (BLU-SLV)", model: "TWO", color: "BLU-SLV", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 40.45, priceExport: null, priceCH: null, rrp: 89, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn02-cml-gry", ref: "GKN02-CML-GRY", label: "TWO (CML-GRY)", model: "TWO", color: "CML-GRY", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 40.45, priceExport: null, priceCH: null, rrp: 89, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn02-blk-slv", ref: "GKN02-BLK-SLV", label: "TWO (BLK-SLV)", model: "TWO", color: "BLK-SLV", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 40.45, priceExport: null, priceCH: null, rrp: 89, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "gkn02-wht-gld", ref: "GKN02-WHT-GLD", label: "TWO (WHT-GLD)", model: "TWO", color: "WHT-GLD", category: "Goggles", collection: "GOGGLES", catalogName: "2026 SUNGLASSES", photoUrl: "", priceFR: 40.45, priceExport: null, priceCH: null, rrp: 89, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — 2026 SUNGLASSES" },
  { id: "mknob1-blk-tort", ref: "MKNOB1-BLK-TORT", label: "BOUCAU (BLK-TORT)", model: "BOUCAU", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob1-tort-gry", ref: "MKNOB1-TORT-GRY", label: "BOUCAU (TORT-GRY)", model: "BOUCAU", color: "TORT-GRY", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob9-hav-smk", ref: "MKNOB9-HAV-SMK", label: "LUZ (HAV-SMK)", model: "LUZ", color: "HAV-SMK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob9-hav-brw", ref: "MKNOB9-HAV-BRW", label: "LUZ (HAV-BRW)", model: "LUZ", color: "HAV-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob9-wd-brw", ref: "MKNOB9-WD-BRW", label: "LUZ (WD-BRW)", model: "LUZ", color: "WD-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknco2-tort-gry", ref: "MKNCO2-TORT-GRY", label: "RUST TORT-REDWD (TORT-GRY)", model: "RUST TORT-REDWD", color: "TORT-GRY", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknco6-tort-gry", ref: "MKNCO6-TORT-GRY", label: "RUST BLK-STN (TORT-GRY)", model: "RUST BLK-STN", color: "TORT-GRY", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknco5-tort-gry", ref: "MKNCO5-TORT-GRY", label: "RUST GRY-LGSTN (TORT-GRY)", model: "RUST GRY-LGSTN", color: "TORT-GRY", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob12-ghrn-stn", ref: "MKNOB12-GHRN-STN", label: "KENT (GHRN-STN)", model: "KENT", color: "GHRN-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob12-smk-slt", ref: "MKNOB12-SMK-SLT", label: "KENT (SMK-SLT)", model: "KENT", color: "SMK-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknob12-tort-dkwd", ref: "MKNOB12-TORT-DKWD", label: "KENT (TORT-DKWD)", model: "KENT", color: "TORT-DKWD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoa3-m-black", ref: "MKNOA3-M-BLACK", label: "STILL (M-BLACK)", model: "STILL", color: "M-BLACK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoa3-dark-gun", ref: "MKNOA3-DARK-GUN", label: "STILL (DARK-GUN)", model: "STILL", color: "DARK-GUN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoa3-matt-silver", ref: "MKNOA3-MATT-SILVER", label: "STILL (MATT-SILVER)", model: "STILL", color: "MATT-SILVER", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc6-tblu-wd", ref: "MKNOC6-TBLU-WD", label: "AARON (TBLU-WD)", model: "AARON", color: "TBLU-WD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc6-tbrw-dwd", ref: "MKNOC6-TBRW-DWD", label: "AARON (TBRW-DWD)", model: "AARON", color: "TBRW-DWD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc7-cstt-slt", ref: "MKNOC7-CSTT-SLT", label: "MARIUS (CSTT-SLT)", model: "MARIUS", color: "CSTT-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc7-grnh-wd", ref: "MKNOC7-GRNH-WD", label: "MARIUS (GRNH-WD)", model: "MARIUS", color: "GRNH-WD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc7-havb-wd", ref: "MKNOC7-HAVB-WD", label: "MARIUS (HAVB-WD)", model: "MARIUS", color: "HAVB-WD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc19-kki-stn", ref: "MKNOC19-KKI-STN", label: "BRYSON (KKI-STN)", model: "BRYSON", color: "KKI-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc19-tort-slt", ref: "MKNOC19-TORT-SLT", label: "BRYSON (TORT-SLT)", model: "BRYSON", color: "TORT-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc20-tort-brw", ref: "MKNOC20-TORT-BRW", label: "JACK (TORT-BRW)", model: "JACK", color: "TORT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc20-havb-hav", ref: "MKNOC20-HAVB-HAV", label: "JACK (HAVB-HAV)", model: "JACK", color: "HAVB-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc20-nvy-havb", ref: "MKNOC20-NVY-HAVB", label: "JACK (NVY-HAVB)", model: "JACK", color: "NVY-HAVB", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc22-amb-tort", ref: "MKNOC22-AMB-TORT", label: "GARY (AMB-TORT)", model: "GARY", color: "AMB-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc22-tort-grn", ref: "MKNOC22-TORT-GRN", label: "GARY (TORT-GRN)", model: "GARY", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc22-havg-havb", ref: "MKNOC22-HAVG-HAVB", label: "GARY (HAVG-HAVB)", model: "GARY", color: "HAVG-HAVB", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc22-hav-grn", ref: "MKNOC22-HAV-GRN", label: "GARY (HAV-GRN)", model: "GARY", color: "HAV-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc32-pnk-tort", ref: "MKNOC32-PNK-TORT", label: "MARIA (PNK-TORT)", model: "MARIA", color: "PNK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod13-grn-wd", ref: "MKNOD13-GRN-WD", label: "JOSEPHINE II (GRN-WD)", model: "JOSEPHINE II", color: "GRN-WD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod13-smkt-slt", ref: "MKNOD13-SMKT-SLT", label: "JOSEPHINE II (SMKT-SLT)", model: "JOSEPHINE II", color: "SMKT-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod13-tort-stn", ref: "MKNOD13-TORT-STN", label: "JOSEPHINE II (TORT-STN)", model: "JOSEPHINE II", color: "TORT-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod1-cbrw-stn", ref: "MKNOD1-CBRW-STN", label: "MONIKA (CBRW-STN)", model: "MONIKA", color: "CBRW-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod1-cpnk-stn", ref: "MKNOD1-CPNK-STN", label: "MONIKA (CPNK-STN)", model: "MONIKA", color: "CPNK-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod1-grnt-slt", ref: "MKNOD1-GRNT-SLT", label: "MONIKA (GRNT-SLT)", model: "MONIKA", color: "GRNT-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod2-tort-gld", ref: "MKNOD2-TORT-GLD", label: "CARISSA (TORT-GLD)", model: "CARISSA", color: "TORT-GLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod2-blu-sil", ref: "MKNOD2-BLU-SIL", label: "CARISSA (BLU-SIL)", model: "CARISSA", color: "BLU-SIL", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod2-cgrn-gld", ref: "MKNOD2-CGRN-GLD", label: "CARISSA (CGRN-GLD)", model: "CARISSA", color: "CGRN-GLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod2-cpnk-pgld", ref: "MKNOD2-CPNK-PGLD", label: "CARISSA (CPNK-PGLD)", model: "CARISSA", color: "CPNK-PGLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod6-tort-pgld", ref: "MKNOD6-TORT-PGLD", label: "LAURA (TORT-PGLD)", model: "LAURA", color: "TORT-PGLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod6-cgrn-gld", ref: "MKNOD6-CGRN-GLD", label: "LAURA (CGRN-GLD)", model: "LAURA", color: "CGRN-GLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod6-cpnk-pgld", ref: "MKNOD6-CPNK-PGLD", label: "LAURA (CPNK-PGLD)", model: "LAURA", color: "CPNK-PGLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod7-bhav-cbrw", ref: "MKNOD7-BHAV-CBRW", label: "JOHN (BHAV-CBRW)", model: "JOHN", color: "BHAV-CBRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod7-tort-grn", ref: "MKNOD7-TORT-GRN", label: "JOHN (TORT-GRN)", model: "JOHN", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod7-cgrn-tort", ref: "MKNOD7-CGRN-TORT", label: "JOHN (CGRN-TORT)", model: "JOHN", color: "CGRN-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod16-pgld-tort", ref: "MKNOD16-PGLD-TORT", label: "JESSIE (PGLD-TORT)", model: "JESSIE", color: "PGLD-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod16-gld-tortm", ref: "MKNOD16-GLD-TORTM", label: "JESSIE (GLD-TORTM)", model: "JESSIE", color: "GLD-TORTM", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod16-gld-havb", ref: "MKNOD16-GLD-HAVB", label: "JESSIE (GLD-HAVB)", model: "JESSIE", color: "GLD-HAVB", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod15-cop-tort", ref: "MKNOD15-COP-TORT", label: "LUCY (COP-TORT)", model: "LUCY", color: "COP-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod15-gld-tortm", ref: "MKNOD15-GLD-TORTM", label: "LUCY (GLD-TORTM)", model: "LUCY", color: "GLD-TORTM", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-grn-tort", ref: "MKNOD10-GRN-TORT", label: "JADE (GRN-TORT)", model: "JADE", color: "GRN-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-tort-pnk", ref: "MKNOD10-TORT-PNK", label: "JADE (TORT-PNK)", model: "JADE", color: "TORT-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-sage-hav", ref: "MKNOD10-SAGE-HAV", label: "JADE (SAGE-HAV)", model: "JADE", color: "SAGE-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-blu-hav", ref: "MKNOD10-BLU-HAV", label: "SCOTTY (BLU-HAV)", model: "SCOTTY", color: "BLU-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-havb-brw", ref: "MKNOD10-HAVB-BRW", label: "SCOTTY (HAVB-BRW)", model: "SCOTTY", color: "HAVB-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod10-grn-tortb", ref: "MKNOD10-GRN-TORTB", label: "SCOTTY (GRN-TORTB)", model: "SCOTTY", color: "GRN-TORTB", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod11-brw-tort", ref: "MKNOD11-BRW-TORT", label: "TAILOR (BRW-TORT)", model: "TAILOR", color: "BRW-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod11-tort-grn", ref: "MKNOD11-TORT-GRN", label: "TAILOR (TORT-GRN)", model: "TAILOR", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod12-crst-hav", ref: "MKNOD12-CRST-HAV", label: "LAYNE (CRST-HAV)", model: "LAYNE", color: "CRST-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod12-grn-hrn", ref: "MKNOD12-GRN-HRN", label: "LAYNE (GRN-HRN)", model: "LAYNE", color: "GRN-HRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod12-hav-blu", ref: "MKNOD12-HAV-BLU", label: "LAYNE (HAV-BLU)", model: "LAYNE", color: "HAV-BLU", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod21-agld-tort", ref: "MKNOD21-AGLD-TORT", label: "GEORGES (AGLD-TORT)", model: "GEORGES", color: "AGLD-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod21-cop-tort", ref: "MKNOD21-COP-TORT", label: "GEORGES (COP-TORT)", model: "GEORGES", color: "COP-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod21-sil-tort", ref: "MKNOD21-SIL-TORT", label: "GEORGES (SIL-TORT)", model: "GEORGES", color: "SIL-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod22-acop-brw", ref: "MKNOD22-ACOP-BRW", label: "MATT (ACOP-BRW)", model: "MATT", color: "ACOP-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod22-agld-tort", ref: "MKNOD22-AGLD-TORT", label: "MATT (AGLD-TORT)", model: "MATT", color: "AGLD-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknod22-sil-hav", ref: "MKNOD22-SIL-HAV", label: "MATT (SIL-HAV)", model: "MATT", color: "SIL-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 47.78, priceExport: null, priceCH: null, rrp: 129, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc30-brw-tort", ref: "MKNOC30-BRW-TORT", label: "SASHA (BRW-TORT)", model: "SASHA", color: "BRW-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoc30-pnk-tort", ref: "MKNOC30-PNK-TORT", label: "SASHA (PNK-TORT)", model: "SASHA", color: "PNK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 51.48, priceExport: null, priceCH: null, rrp: 139, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe03-blk-tort", ref: "MKNOE03-BLK-TORT", label: "SALLY (BLK-TORT)", model: "SALLY", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe03-tort-mst", ref: "MKNOE03-TORT-MST", label: "SALLY (TORT-MST)", model: "SALLY", color: "TORT-MST", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe03-org-tort", ref: "MKNOE03-ORG-TORT", label: "SALLY (ORG-TORT)", model: "SALLY", color: "ORG-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe06-org-hav", ref: "MKNOE06-ORG-HAV", label: "GIULIA (ORG-HAV)", model: "GIULIA", color: "ORG-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe06-blu-pur", ref: "MKNOE06-BLU-PUR", label: "GIULIA (BLU-PUR)", model: "GIULIA", color: "BLU-PUR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe09-blk-blu", ref: "MKNOE09-BLK-BLU", label: "DARIA (BLK-BLU)", model: "DARIA", color: "BLK-BLU", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe09-tort-kki", ref: "MKNOE09-TORT-KKI", label: "DARIA (TORT-KKI)", model: "DARIA", color: "TORT-KKI", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe09-blu-tort", ref: "MKNOE09-BLU-TORT", label: "DARIA (BLU-TORT)", model: "DARIA", color: "BLU-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe08-smk-tort", ref: "MKNOE08-SMK-TORT", label: "NIKA (SMK-TORT)", model: "NIKA", color: "SMK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe08-ivo-hav", ref: "MKNOE08-IVO-HAV", label: "NIKA (IVO-HAV)", model: "NIKA", color: "IVO-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe08-hav", ref: "MKNOE08-HAV", label: "NIKA (HAV)", model: "NIKA", color: "HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe18-blu-pnk", ref: "MKNOE18-BLU-PNK", label: "MANDY (BLU-PNK)", model: "MANDY", color: "BLU-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe18-brw-tort", ref: "MKNOE18-BRW-TORT", label: "MANDY (BRW-TORT)", model: "MANDY", color: "BRW-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe18-tort-org", ref: "MKNOE18-TORT-ORG", label: "MANDY (TORT-ORG)", model: "MANDY", color: "TORT-ORG", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe07-grn-tort", ref: "MKNOE07-GRN-TORT", label: "TOM (GRN-TORT)", model: "TOM", color: "GRN-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe07-tort-mst", ref: "MKNOE07-TORT-MST", label: "TOM (TORT-MST)", model: "TOM", color: "TORT-MST", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe07-blu-tort", ref: "MKNOE07-BLU-TORT", label: "TOM (BLU-TORT)", model: "TOM", color: "BLU-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe02-blk-tort", ref: "MKNOE02-BLK-TORT", label: "KYLE (BLK-TORT)", model: "KYLE", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe02-blu-org", ref: "MKNOE02-BLU-ORG", label: "KYLE (BLU-ORG)", model: "KYLE", color: "BLU-ORG", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe02-smk-hav", ref: "MKNOE02-SMK-HAV", label: "KYLE (SMK-HAV)", model: "KYLE", color: "SMK-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe01-crst-hav", ref: "MKNOE01-CRST-HAV", label: "DYLAN (CRST-HAV)", model: "DYLAN", color: "CRST-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe01-blu-tort", ref: "MKNOE01-BLU-TORT", label: "DYLAN (BLU-TORT)", model: "DYLAN", color: "BLU-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe01-hav-grn", ref: "MKNOE01-HAV-GRN", label: "DYLAN (HAV-GRN)", model: "DYLAN", color: "HAV-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe10-ivo-stn", ref: "MKNOE10-IVO-STN", label: "HELEN (IVO-STN)", model: "HELEN", color: "IVO-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe10-grn-slt", ref: "MKNOE10-GRN-SLT", label: "HELEN (GRN-SLT)", model: "HELEN", color: "GRN-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe10-tortp-stn", ref: "MKNOE10-TORTP-STN", label: "HELEN (TORTP-STN)", model: "HELEN", color: "TORTP-STN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe10-tort-slt", ref: "MKNOE10-TORT-SLT", label: "HELEN (TORT-SLT)", model: "HELEN", color: "TORT-SLT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe16-tort-crl", ref: "MKNOE16-TORT-CRL", label: "MILY (TORT-CRL)", model: "MILY", color: "TORT-CRL", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe16-snd-hav", ref: "MKNOE16-SND-HAV", label: "MILY (SND-HAV)", model: "MILY", color: "SND-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe16-burg-tort", ref: "MKNOE16-BURG-TORT", label: "MILY (BURG-TORT)", model: "MILY", color: "BURG-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe12-tort-brw", ref: "MKNOE12-TORT-BRW", label: "VALERIE (TORT-BRW)", model: "VALERIE", color: "TORT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe12-grn-tort", ref: "MKNOE12-GRN-TORT", label: "VALERIE (GRN-TORT)", model: "VALERIE", color: "GRN-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe12-blu-clr", ref: "MKNOE12-BLU-CLR", label: "VALERIE (BLU-CLR)", model: "VALERIE", color: "BLU-CLR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe05-tort-grn", ref: "MKNOE05-TORT-GRN", label: "AVA (TORT-GRN)", model: "AVA", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe05-blk-tort", ref: "MKNOE05-BLK-TORT", label: "AVA (BLK-TORT)", model: "AVA", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe05-mnt-tort", ref: "MKNOE05-MNT-TORT", label: "AVA (MNT-TORT)", model: "AVA", color: "MNT-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe13-smk-pur", ref: "MKNOE13-SMK-PUR", label: "TESSA (SMK-PUR)", model: "TESSA", color: "SMK-PUR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe13-tort-snd", ref: "MKNOE13-TORT-SND", label: "TESSA (TORT-SND)", model: "TESSA", color: "TORT-SND", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe13-brw-hav", ref: "MKNOE13-BRW-HAV", label: "TESSA (BRW-HAV)", model: "TESSA", color: "BRW-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe17-blk-tort", ref: "MKNOE17-BLK-TORT", label: "JANA (BLK-TORT)", model: "JANA", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe17-tortp-pur", ref: "MKNOE17-TORTP-PUR", label: "JANA (TORTP-PUR)", model: "JANA", color: "TORTP-PUR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknoe17-tort-pnk", ref: "MKNOE17-TORT-PNK", label: "JANA (TORT-PNK)", model: "JANA", color: "TORT-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof08-blu-hav", ref: "MKNOF08-BLU-HAV", label: "SVEN (BLU-HAV)", model: "SVEN", color: "BLU-HAV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof08-crst-tort", ref: "MKNOF08-CRST-TORT", label: "SVEN (CRST-TORT)", model: "SVEN", color: "CRST-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof08-hav-blu", ref: "MKNOF08-HAV-BLU", label: "SVEN (HAV-BLU)", model: "SVEN", color: "HAV-BLU", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof27-bur-tort", ref: "MKNOF27-BUR-TORT", label: "ALMA (BUR-TORT)", model: "ALMA", color: "BUR-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof27-tort-brw", ref: "MKNOF27-TORT-BRW", label: "ALMA (TORT-BRW)", model: "ALMA", color: "TORT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof27-tort-grn", ref: "MKNOF27-TORT-GRN", label: "ALMA (TORT-GRN)", model: "ALMA", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof29-blu-tort", ref: "MKNOF29-BLU-TORT", label: "ALANI (BLU-TORT)", model: "ALANI", color: "BLU-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof29-tort-bur", ref: "MKNOF29-TORT-BUR", label: "ALANI (TORT-BUR)", model: "ALANI", color: "TORT-BUR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof29-tort-pnk", ref: "MKNOF29-TORT-PNK", label: "ALANI (TORT-PNK)", model: "ALANI", color: "TORT-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof30-blk-tort", ref: "MKNOF30-BLK-TORT", label: "GILMOR (BLK-TORT)", model: "GILMOR", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof30-hav-bur", ref: "MKNOF30-HAV-BUR", label: "GILMOR (HAV-BUR)", model: "GILMOR", color: "HAV-BUR", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof30-pnk-tortp", ref: "MKNOF30-PNK-TORTP", label: "GILMOR (PNK-TORTP)", model: "GILMOR", color: "PNK-TORTP", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof12-blk-lgld", ref: "MKNOF12-BLK-LGLD", label: "EDWARD (BLK-LGLD)", model: "EDWARD", color: "BLK-LGLD", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof12-grn-cop", ref: "MKNOF12-GRN-COP", label: "EDWARD (GRN-COP)", model: "EDWARD", color: "GRN-COP", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof12-smk-lcop", ref: "MKNOF12-SMK-LCOP", label: "EDWARD (SMK-LCOP)", model: "EDWARD", color: "SMK-LCOP", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof15-blu-slv", ref: "MKNOF15-BLU-SLV", label: "GRIFFIN (BLU-SLV)", model: "GRIFFIN", color: "BLU-SLV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof15-havb-slv", ref: "MKNOF15-HAVB-SLV", label: "GRIFFIN (HAVB-SLV)", model: "GRIFFIN", color: "HAVB-SLV", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof15-tort-gun", ref: "MKNOF15-TORT-GUN", label: "GRIFFIN (TORT-GUN)", model: "GRIFFIN", color: "TORT-GUN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof19-blk-tort", ref: "MKNOF19-BLK-TORT", label: "SPENCER (BLK-TORT)", model: "SPENCER", color: "BLK-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof19-tort-brw", ref: "MKNOF19-TORT-BRW", label: "SPENCER (TORT-BRW)", model: "SPENCER", color: "TORT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof19-tort-ivo", ref: "MKNOF19-TORT-IVO", label: "SPENCER (TORT-IVO)", model: "SPENCER", color: "TORT-IVO", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof21-blk-crst", ref: "MKNOF21-BLK-CRST", label: "AUGUST (BLK-CRST)", model: "AUGUST", color: "BLK-CRST", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof21-crst-tort", ref: "MKNOF21-CRST-TORT", label: "AUGUST (CRST-TORT)", model: "AUGUST", color: "CRST-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof21-grn-tort", ref: "MKNOF21-GRN-TORT", label: "AUGUST (GRN-TORT)", model: "AUGUST", color: "GRN-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 55.19, priceExport: null, priceCH: null, rrp: 149, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof22-chmp-pnk", ref: "MKNOF22-CHMP-PNK", label: "JOSY (CHMP-PNK)", model: "JOSY", color: "CHMP-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof22-glt-chmp", ref: "MKNOF22-GLT-CHMP", label: "JOSY (GLT-CHMP)", model: "JOSY", color: "GLT-CHMP", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof22-tort-brw", ref: "MKNOF22-TORT-BRW", label: "JOSY (TORT-BRW)", model: "JOSY", color: "TORT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof23-glt-blu", ref: "MKNOF23-GLT-BLU", label: "JILL (GLT-BLU)", model: "JILL", color: "GLT-BLU", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof23-glt-brw", ref: "MKNOF23-GLT-BRW", label: "JILL (GLT-BRW)", model: "JILL", color: "GLT-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof23-tort-pnk", ref: "MKNOF23-TORT-PNK", label: "JILL (TORT-PNK)", model: "JILL", color: "TORT-PNK", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof24-hav-crm", ref: "MKNOF24-HAV-CRM", label: "LEO (HAV-CRM)", model: "LEO", color: "HAV-CRM", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof24-nvy-lime", ref: "MKNOF24-NVY-LIME", label: "LEO (NVY-LIME)", model: "LEO", color: "NVY-LIME", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof24-sage-brw", ref: "MKNOF24-SAGE-BRW", label: "LEO (SAGE-BRW)", model: "LEO", color: "SAGE-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof25-aqua-tort", ref: "MKNOF25-AQUA-TORT", label: "ARI (AQUA-TORT)", model: "ARI", color: "AQUA-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof25-mst-crst", ref: "MKNOF25-MST-CRST", label: "ARI (MST-CRST)", model: "ARI", color: "MST-CRST", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof25-tort-grn", ref: "MKNOF25-TORT-GRN", label: "ARI (TORT-GRN)", model: "ARI", color: "TORT-GRN", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof26-blu-tort", ref: "MKNOF26-BLU-TORT", label: "EZ (BLU-TORT)", model: "EZ", color: "BLU-TORT", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof26-crst-brw", ref: "MKNOF26-CRST-BRW", label: "EZ (CRST-BRW)", model: "EZ", color: "CRST-BRW", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
  { id: "mknof26-tort-amb", ref: "MKNOF26-TORT-AMB", label: "EZ (TORT-AMB)", model: "EZ", color: "TORT-AMB", category: "Optics", collection: "Optics", catalogName: "Optic 2026", photoUrl: "", priceFR: 29.26, priceExport: null, priceCH: null, rrp: 79, qty: 0, stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Actif", lastModified: "2026-09-12", modifiedBy: "Import — Optic 2026" },
];

const BESTSELLERS = [
  { name: "Monture Aria", units: 412, ca: 52736, caPrev: 47820, rep: "Camille Dubois", typology: "opticien", client: "Optique du Marais", category: "Premium" },
  { name: "Verres Optique Bleu+", units: 380, ca: 33820, caPrev: 35100, rep: "Elena Ruiz", typology: "opticien", client: "Óptica Barcelona", category: "Optics" },
  { name: "Masque Glacier", units: 290, ca: 27840, caPrev: 21200, rep: "Marc Lefèvre", typology: "ski_shop", client: "Lunetterie Centrale", category: "Goggles" },
  { name: "Monture Nova", units: 260, ca: 16640, caPrev: 15980, rep: "Camille Dubois", typology: "fashion_store", client: "Vision Sud SARL", category: "Classic" },
  { name: "Totem vitrine", units: 54, ca: 6480, caPrev: 4100, rep: "Elena Ruiz", typology: "concept_store", client: "Mirall Visió", category: "Display" },
];

const SHIPPING_FEE_HT = 9.60;

function priceFor(product, country) {
  if (!product) return 0;
  if (country === "France" || country === "Espagne") return product.priceFR ?? product.rrp ?? 0;
  if (country === "Suisse") return product.priceCH ?? product.rrp ?? 0;
  return product.priceExport ?? product.rrp ?? 0;
}

function photoFor(name) {
  const letter = name.trim().charAt(0);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <rect width='200' height='200' fill='#101828'/>
    <text x='50%' y='58%' font-family='Manrope, sans-serif' font-size='90' fill='#7FB3AC' text-anchor='middle'>${letter}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function money(n) {
  return Number(n).toLocaleString("fr-FR") + " €";
}

function typologyLabel(code, lang) {
  const t = TYPOLOGIES.find((x) => x.code === code);
  return t ? t[lang] : code;
}

const COUNTRIES = [
  { name: "France", dial: "+33", tax: "SIRET / identifiant fiscal" },
  { name: "Espagne", dial: "+34", tax: "NIF / CIF (identificador fiscal)" },
  { name: "Allemagne", dial: "+49", tax: "Steuernummer / USt-IdNr." },
  { name: "Italie", dial: "+39", tax: "Partita IVA / Codice Fiscale" },
  { name: "Portugal", dial: "+351", tax: "NIF / NIPC" },
  { name: "Royaume-Uni", dial: "+44", tax: "Company Number / VAT Number" },
  { name: "Belgique", dial: "+32", tax: "Numéro d'entreprise (BCE)" },
  { name: "Pays-Bas", dial: "+31", tax: "KVK-nummer / BTW-nummer" },
  { name: "Suisse", dial: "+41", tax: "IDE / numéro de TVA suisse" },
];
function taxIdLabel(country) {
  return (COUNTRIES.find((c) => c.name === country) || {}).tax || "Identifiant fiscal";
}
function dialCodeFor(country) {
  return (COUNTRIES.find((c) => c.name === country) || {}).dial || "+33";
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).setHours(23, 59, 59, 999) < Date.now();
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(period, offsetYears) {
  const now = new Date();
  const y = now.getFullYear() - offsetYears;
  if (period === "semaine") {
    const day = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1); monday.setFullYear(y);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  if (period === "mois") {
    const from = new Date(y, now.getMonth(), 1);
    const to = new Date(y, now.getMonth() + 1, 0);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (period === "trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    return { from: isoDate(from), to: isoDate(to) };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function isFicheIncomplete(account) {
  return (
    !account.taxId || account.taxId === "—" ||
    !account.vat || account.vat === "—" ||
    !account.iban || account.iban === "—" ||
    !account.billing?.street
  );
}

const emptyAccountForm = {
  name: "", type: "prospect", country: "France", typology: "opticien",
  billing: { street: "", postalCode: "", city: "" },
  delivery: { street: "", postalCode: "", city: "" },
  contact: "", phoneCode: "+33", phone: "", mobileCode: "+33", mobile: "", email: "",
  taxId: "", iban: "", bic: "", sepaMandate: "Non reçu", ownerRep: "", masterRep: "",
};

const emptyProductForm = {
  id: null, ref: "", label: "", model: "", color: "", category: "Premium", collection: "", catalogName: "2026 SUNGLASSES",
  photoUrl: "", priceFR: "", priceExport: "", priceCH: "", rrp: "", qty: 0,
  stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Nouveau",
};

/* ================= App ================= */

export default function Prototype() {
  const [lang, setLang] = useState("fr");
  const t = (k) => STRINGS[lang][k] || STRINGS.fr[k] || k;

  const [role, setRole] = useState("rep");
  const [view, setView] = useState("dashboard");
  const [cart, setCart] = useState({}); // { productId: { qty, offert } }
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const catalogNames = useMemo(() => [...new Set(catalog.map((p) => p.catalogName || "Sans catalogue"))], [catalog]);
  const [selectedCatalogs, setSelectedCatalogs] = useState(null);
  const activeCatalogs = selectedCatalogs || catalogNames;
  const toggleCatalogSelection = (name) => {
    setSelectedCatalogs((cur) => {
      const base = cur || catalogNames;
      return base.includes(name) ? base.filter((c) => c !== name) : [...base, name];
    });
  };
  const [catalogHistory, setCatalogHistory] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [discountApplied, setDiscountApplied] = useState({});
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [shippingOffert, setShippingOffert] = useState(false);
  const [queue, setQueue] = useState([
    { id: "o1", account: "Vision Sud SARL", rep: "Camille Dubois", total: 1240, status: "nouvelle", createdAt: "2026-09-08",
      items: [{ id: "p1", ref: "AR-204", name: "Monture Aria", price: 128, qty: 8, offert: false }, { id: "p9", ref: "DP-010", name: "Présentoir comptoir", price: 45, qty: 1, offert: true }],
      categoryBreakdown: [
        { category: "Premium", subtotal: 1024, discountApplied: true, discountRate: 0.1, items: [{ id: "p1", name: "Monture Aria", price: 128, qty: 8, offert: false }] },
        { category: "Display", subtotal: 45, discountApplied: false, discountRate: 0.05, items: [{ id: "p9", name: "Présentoir comptoir", price: 45, qty: 1, offert: true }] },
      ] },
  ]);
  const [accountForm, setAccountForm] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [routeComputed, setRouteComputed] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState("all");
  const [bfPeriod, setBfPeriod] = useState("trimestre");
  const [bfReps, setBfReps] = useState([]);
  const [bfTypologies, setBfTypologies] = useState([]);
  const [bfCategories, setBfCategories] = useState([]);
  const [bfClient, setBfClient] = useState("all");
  const [bfGenerated, setBfGenerated] = useState(false);
  const [repDataSubview, setRepDataSubview] = useState("bestsellers");
  const [cpPeriod, setCpPeriod] = useState("mois");
  const [cpClient, setCpClient] = useState("all");
  const [cpGenerated, setCpGenerated] = useState(false);
  const [repOrdersFrom, setRepOrdersFrom] = useState("");
  const [repOrdersTo, setRepOrdersTo] = useState("");
  const [repOrdersClient, setRepOrdersClient] = useState("all");
  const [repOrdersSearch, setRepOrdersSearch] = useState("");
  const [dataSubview, setDataSubview] = useState("bestsellers");
  const [anaPeriodA, setAnaPeriodA] = useState({ from: "2026-01-01", to: new Date().toISOString().slice(0, 10) });
  const [anaPeriodB, setAnaPeriodB] = useState({ from: "2025-01-01", to: "2025-12-31" });
  const [anaReps, setAnaReps] = useState([]);
  const [anaMasterReps, setAnaMasterReps] = useState([]);
  const [anaCountries, setAnaCountries] = useState([]);
  const [anaCategories, setAnaCategories] = useState([]);
  const [anaClients, setAnaClients] = useState([]);
  const [anaTypologies, setAnaTypologies] = useState([]);
  const [anaMetric, setAnaMetric] = useState("both");
  const [extractFrom, setExtractFrom] = useState("");
  const [extractTo, setExtractTo] = useState("");
  const [tasks, setTasks] = useState([
    { id: "t1", rep: "Camille Dubois", accountId: "a2", accountName: "Vision Sud SARL", label: "Relancer — devis en cours", due: new Date().toISOString().slice(0, 10), done: false },
    { id: "t2", rep: "Camille Dubois", accountId: "a3", accountName: "Óptica Barcelona", label: "Visite prévue 14h30", due: new Date().toISOString().slice(0, 10), done: false },
    { id: "t3", rep: "Camille Dubois", accountId: "a1", accountName: "Optique du Marais", label: "Suivi SAV", due: "2026-09-08", done: false },
  ]);
  const [interactionForm, setInteractionForm] = useState({ type: "Visite", comment: "", followUp: "" });
  const [taskForm, setTaskForm] = useState({ label: "", due: "", accountId: "" });
  const [agendaSubview, setAgendaSubview] = useState("rdv");
  const [editForm, setEditForm] = useState(null);
  const [planForm, setPlanForm] = useState({ type: "Rendez-vous", date: "", time: "", note: "" });
  const [savForm, setSavForm] = useState({ motif: "", description: "" });
  const [listening, setListening] = useState(false);
  const [agendaEvents, setAgendaEvents] = useState([]);
  const [savTickets, setSavTickets] = useState([]);
  const [dashPeriod, setDashPeriod] = useState("mois");
  const [repsList, setRepsList] = useState(REPS);
  const [masterRepsList, setMasterRepsList] = useState(MASTER_REPS);
  const [newMasterRepForm, setNewMasterRepForm] = useState(null);
  const currentMasterRep = masterRepsList[0]?.name || null;
  const [newRepForm, setNewRepForm] = useState(null);
  const [objectives, setObjectives] = useState([
    { id: "obj1", rep: "Camille Dubois", typologies: ["opticien"], categories: ["Premium", "Classic"], target: 30000, period: "Trimestre" },
    { id: "obj2", rep: "Elena Ruiz", typologies: ["opticien"], categories: ["Optics"], target: 18000, period: "Trimestre" },
  ]);
  const [objForm, setObjForm] = useState({ rep: "", typologies: ["opticien"], categories: ["Premium"], target: "", period: "Trimestre", metric: "Chiffre d'affaires" });
  const [selectedRepProfile, setSelectedRepProfile] = useState(null);
  const [businessRules, setBusinessRules] = useState([
    { id: "r1", label: "Remise catégorie Premium", type: "Remise catégorie", value: "10%", scope: "Global", target: "", active: true, category: "Premium", categories: ["Premium"], rate: "10" },
    { id: "r2", label: "Remise catégorie Optics", type: "Remise catégorie", value: "15%", scope: "Global", target: "", active: true, category: "Optics", categories: ["Optics"], rate: "15" },
    { id: "r3", label: "Remise combo Premium + Optics offerts ensemble", type: "Remise combo", value: "[à définir]", scope: "Global", target: "", active: true, categories: ["Premium", "Optics"], rate: "" },
    { id: "r4", label: "Frais de port", type: "Frais de port", value: "9,60 € HT par défaut", scope: "Global", target: "", active: true, amount: "9.60", threshold: "" },
    { id: "r5", label: "Displays offerts", type: "Display", value: "Condition d'octroi : [à définir]", scope: "Global", target: "", active: true },
    { id: "r6", label: "Conditions de paiement par défaut", type: "Paiement", value: "[à définir selon accord client]", scope: "Global", target: "", active: true },
    { id: "r7", label: "Mapping export Dolibarr", type: "Export", value: "Profil « Import standard v2 »", scope: "Global", target: "", active: true },
  ]);
  const [newRuleForm, setNewRuleForm] = useState(null);
  const [importedRows, setImportedRows] = useState(null);
  const [importMapping, setImportMapping] = useState(null);
  const [importMode, setImportMode] = useState("both");
  const [importCatalogMode, setImportCatalogMode] = useState("existing");
  const [adminImportSubview, setAdminImportSubview] = useState("catalogue");
  const [clientImportedRows, setClientImportedRows] = useState(null);
  const [clientImportMapping, setClientImportMapping] = useState(null);
  const [clientImportMode, setClientImportMode] = useState("both");
  const [clientImportDefaultRep, setClientImportDefaultRep] = useState("");
  const [importCatalogName, setImportCatalogName] = useState("");
  const [deleteCatalogTarget, setDeleteCatalogTarget] = useState(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [catFilterCategory, setCatFilterCategory] = useState("all");
  const [adminCatFilter, setAdminCatFilter] = useState("all");
  const [adminCatalogFilter, setAdminCatalogFilter] = useState("all");
  const [adminStockFilter, setAdminStockFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminPage, setAdminPage] = useState(1);
  const [productForm, setProductForm] = useState(null);
  const [fdSearch, setFdSearch] = useState("");
  const [fdPeriod, setFdPeriod] = useState("all");
  const [fdStatusFilter, setFdStatusFilter] = useState("all");
  const [exportCheck, setExportCheck] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [dirAgendaRep, setDirAgendaRep] = useState("all");
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const openFiche = (account) => {
    setSelectedAccount(account);
    setView("fiche");
    if (role === "frontdesk" && account.newForFrontdesk) {
      setAccounts((accs) => accs.map((a) => (a.id === account.id ? { ...a, newForFrontdesk: false } : a)));
    }
  };

  const updateAccount = (id, patch) => {
    setAccounts((accs) => {
      const next = accs.map((a) => (a.id === id ? { ...a, ...patch(a) } : a));
      setSelectedAccount(next.find((a) => a.id === id));
      return next;
    });
  };

  const logInteraction = () => {
    if (!selectedAccount) return;
    const today = new Date().toISOString().slice(0, 10);
    const entry = { date: today, label: interactionForm.type, detail: interactionForm.comment || "—" };
    updateAccount(selectedAccount.id, (a) => ({ history: [entry, ...a.history], lastContact: "Aujourd'hui" }));
    if (interactionForm.followUp) {
      setTasks((ts) => [
        { id: "t" + (ts.length + 1), accountId: selectedAccount.id, accountName: selectedAccount.name, label: `Relance — ${interactionForm.type}`, due: interactionForm.followUp, done: false },
        ...ts,
      ]);
    }
    setInteractionForm({ type: "Visite", comment: "", followUp: "" });
  };

  const changeStage = (stage) => {
    if (!selectedAccount) return;
    const today = new Date().toISOString().slice(0, 10);
    updateAccount(selectedAccount.id, (a) => ({
      stage,
      wonDate: stage === "Gagné" ? today : a.wonDate,
      lostDate: stage === "Perdu" ? today : a.lostDate,
    }));
  };

  const toggleTaskDone = (id) => setTasks((ts) => ts.map((tk) => (tk.id === id ? { ...tk, done: !tk.done } : tk)));

  const createTask = () => {
    if (!taskForm.label.trim() || !taskForm.due) return;
    const account = accounts.find((a) => a.id === taskForm.accountId);
    setTasks((ts) => [
      { id: "t" + (ts.length + 1), rep: "Camille Dubois", accountId: account ? account.id : null, accountName: account ? account.name : "Moi-même", label: taskForm.label, due: taskForm.due, done: false },
      ...ts,
    ]);
    setTaskForm({ label: "", due: "", accountId: "" });
  };

  const saveEditForm = () => {
    if (!selectedAccount || !editForm) return;
    updateAccount(selectedAccount.id, () => ({ ...editForm }));
    setEditForm(null);
  };

  const addAgendaEvent = () => {
    if (!selectedAccount || !planForm.date) return;
    setAgendaEvents((evs) => [
      ...evs,
      { id: "ag" + (evs.length + 1), accountId: selectedAccount.id, accountName: selectedAccount.name, rep: "Camille Dubois", type: planForm.type, date: planForm.date, time: planForm.time, note: planForm.note },
    ]);
    setPlanForm({ type: "Rendez-vous", date: "", time: "", note: "" });
  };

  const createSavTicket = () => {
    if (!selectedAccount || !savForm.motif.trim()) return;
    setSavTickets((ts) => [
      { id: "sav" + (ts.length + 1), accountId: selectedAccount.id, accountName: selectedAccount.name, motif: savForm.motif, description: savForm.description, date: new Date().toISOString().slice(0, 10), status: "ouvert" },
      ...ts,
    ]);
    updateAccount(selectedAccount.id, (a) => ({ history: [{ date: new Date().toISOString().slice(0, 10), label: "SAV", detail: savForm.motif }, ...a.history] }));
    notify("sav", `Ticket SAV — ${selectedAccount.name} : ${savForm.motif}`, selectedAccount.id);
    setSavForm({ motif: "", description: "" });
  };

  const startVoiceNote = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInteractionForm((f) => ({ ...f, comment: f.comment + (f.comment ? " " : "") + "[Dictée vocale non supportée sur ce navigateur]" }));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "fr-FR";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInteractionForm((f) => ({ ...f, comment: f.comment + (f.comment ? " " : "") + transcript }));
    };
    recognition.start();
  };

  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedAccount) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const attachment = {
        id: "att" + Date.now(),
        name: file.name,
        type: file.type,
        dataUrl: evt.target.result,
        date: new Date().toISOString().slice(0, 10),
        uploadedBy: role,
      };
      updateAccount(selectedAccount.id, (a) => ({ attachments: [attachment, ...(a.attachments || [])] }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const exportDolibarrFile = (order) => {
    const paymentRule = businessRules.find((r) => r.type === "Paiement" && r.active);
    const wb = XLSX.utils.book_new();
    const cmdSheet = XLSX.utils.json_to_sheet([{
      ref_commande: order.id, date_commande: new Date().toISOString().slice(0, 10),
      code_client: order.account.replace(/\s+/g, "").toUpperCase().slice(0, 8), nom_client: order.account,
      commercial: order.rep, conditions_paiement: paymentRule ? paymentRule.value : "À définir",
      frais_port_ht: order.shippingFee ?? SHIPPING_FEE_HT, statut: "Validée",
    }]);
    const lignes = (order.items || []).map((it) => ({
      ref_commande: order.id, ref_produit: it.ref || it.id, description: it.label,
      quantite: it.qty, prix_unitaire: it.offert ? 0 : it.price, remise_pct: 0,
      tva: 20, montant_ht: it.offert ? 0 : it.price * it.qty, commentaire: it.offert ? "Offert" : "",
    }));
    lignes.push({
      ref_commande: order.id, ref_produit: "FRAIS-PORT", description: "Frais de port",
      quantite: 1, prix_unitaire: order.shippingFee ?? SHIPPING_FEE_HT, remise_pct: 0,
      tva: 20, montant_ht: order.shippingFee ?? SHIPPING_FEE_HT,
      commentaire: (order.shippingFee ?? SHIPPING_FEE_HT) === 0 ? "Offert" : "",
    });
    const lignesSheet = XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ info: "Aucune ligne (démo)" }]);
    XLSX.utils.book_append_sheet(wb, cmdSheet, "Commande");
    XLSX.utils.book_append_sheet(wb, lignesSheet, "Lignes");
    XLSX.writeFile(wb, `Dolibarr_import_${order.id}.xlsx`);
  };

  const openExportCheck = (order) => {
    const account = accounts.find((a) => a.name === order.account);
    const paymentRule = businessRules.find((r) => r.type === "Paiement" && r.active);
    const checks = [
      { label: "Fiche client trouvée", ok: !!account },
      { label: "Identifiant fiscal renseigné", ok: !!account && account.taxId && account.taxId !== "—" },
      { label: "N° TVA / équivalent renseigné", ok: !!account && account.vat && account.vat !== "—" },
      { label: "Adresse de facturation complète", ok: !!account && !!account.billing?.street && !!account.billing?.postalCode && !!account.billing?.city },
      { label: "Conditions de paiement définies", ok: !!paymentRule && paymentRule.value && !paymentRule.value.includes("[à définir") },
      { label: "Au moins une ligne de commande", ok: (order.items || []).length > 0 },
    ];
    setExportCheck({ order, checks });
  };

  const confirmExport = () => {
    exportDolibarrFile(exportCheck.order);
    setQueue((q) => q.map((x) => (x.id === exportCheck.order.id ? { ...x, status: "importée" } : x)));
    setExportCheck(null);
  };

  const createRep = () => {
    if (!newRepForm.name.trim() || !newRepForm.email.trim()) return;
    setRepsList((rl) => [...rl, {
      id: "r" + (rl.length + 1), name: newRepForm.name, country: newRepForm.country,
      region: newRepForm.region || "—", ca: 0, objectif: Number(newRepForm.objectif) || 0,
      masterRep: newRepForm.masterRep || null,
    }]);
    setToast(`Identifiants envoyés à ${newRepForm.email} (simulation — en production, un email réel serait déclenché)`);
    setTimeout(() => setToast(null), 4000);
    setNewRepForm(null);
  };

  const createMasterRep = () => {
    if (!newMasterRepForm.name.trim() || !newMasterRepForm.email.trim()) return;
    setMasterRepsList((ml) => [...ml, {
      id: "mr" + (ml.length + 1), name: newMasterRepForm.name, country: newMasterRepForm.country,
      region: newMasterRepForm.region || "—",
    }]);
    setToast(`Identifiants envoyés à ${newMasterRepForm.email} (simulation — en production, un email réel serait déclenché)`);
    setTimeout(() => setToast(null), 4000);
    setNewMasterRepForm(null);
  };

  const assignObjective = () => {
    if (!objForm.rep || !objForm.target || objForm.categories.length === 0 || objForm.typologies.length === 0) return;
    setObjectives((os) => [...os, { id: "obj" + (os.length + 1), ...objForm, target: Number(objForm.target) }]);
    setObjForm({ rep: "", typologies: ["opticien"], categories: ["Premium"], target: "", period: "Trimestre", metric: "Chiffre d'affaires" });
  };

  const toggleObjCategory = (cat) => {
    setObjForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }));
  };

  const toggleObjTypology = (code) => {
    setObjForm((f) => ({
      ...f,
      typologies: f.typologies.includes(code) ? f.typologies.filter((c) => c !== code) : [...f.typologies, code],
    }));
  };

  const toggleBfRep = (name) => setBfReps((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const toggleBfTypology = (code) => setBfTypologies((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]));
  const toggleBfCategory = (cat) => setBfCategories((cur) => (cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat]));

  const toggleAnaRep = (name) => setAnaReps((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const toggleAnaMasterRep = (name) => setAnaMasterReps((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const toggleAnaCountry = (c) => setAnaCountries((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const toggleAnaCategory = (c) => setAnaCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const toggleAnaClient = (name) => setAnaClients((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const toggleAnaTypology = (code) => setAnaTypologies((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]));

  const orderMatchesAnalyticsFilters = (o) => {
    if (anaReps.length && !anaReps.includes(o.rep)) return false;
    if (anaMasterReps.length) {
      const rep = repsList.find((r) => r.name === o.rep);
      if (!rep || !anaMasterReps.includes(rep.masterRep)) return false;
    }
    const account = accounts.find((a) => a.name === o.account);
    if (anaCountries.length && (!account || !anaCountries.includes(account.country))) return false;
    if (anaClients.length && !anaClients.includes(o.account)) return false;
    if (anaTypologies.length && (!account || !anaTypologies.includes(account.typology))) return false;
    if (anaCategories.length) {
      const orderCategories = (o.items || []).map((it) => {
        const p = catalog.find((pp) => pp.ref === it.ref || pp.id === it.id);
        return p ? p.category : null;
      });
      if (!orderCategories.some((c) => anaCategories.includes(c))) return false;
    }
    if (anaMetric === "ferme" && o.isPreOrder) return false;
    if (anaMetric === "precommande" && !o.isPreOrder) return false;
    return true;
  };

  const ordersInPeriod = (period) => queue.filter((o) => orderMatchesAnalyticsFilters(o) && o.createdAt >= period.from && o.createdAt <= period.to);

  const exportDataExtract = () => {
    const from = extractFrom || "0000-00-00";
    const to = extractTo || "9999-99-99";
    const ordersInRange = queue.filter((o) => o.createdAt >= from && o.createdAt <= to);
    const wb = XLSX.utils.book_new();
    const ordersSheet = XLSX.utils.json_to_sheet(ordersInRange.map((o) => ({
      id: o.id, client: o.account, representant: o.rep, date: o.createdAt,
      montant_marchandise: o.merchandiseTotal ?? (o.total - (o.shippingFee ?? SHIPPING_FEE_HT)),
      frais_port: o.shippingFee ?? SHIPPING_FEE_HT,
      montant_total: o.total, statut: o.status, precommande: o.isPreOrder ? "Oui" : "Non",
      livraison_souhaitee: o.desiredDeliveryDate || "", note: o.orderNote || "",
    })));
    const linesRows = [];
    ordersInRange.forEach((o) => (o.items || []).forEach((it) => {
      linesRows.push({ commande_id: o.id, client: o.account, produit: it.label, ref: it.ref || it.id, qte: it.qty, prix_unitaire: it.price, offert: it.offert ? "Oui" : "Non" });
    }));
    const clientsSheet = XLSX.utils.json_to_sheet(accounts.map((a) => ({
      nom: a.name, type: a.type, pays: a.country, typologie: typologyLabel(a.typology, "fr"),
      representant: a.ownerRep || "", stage: a.stage,
    })));
    XLSX.utils.book_append_sheet(wb, ordersSheet, "Commandes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linesRows.length ? linesRows : [{ info: "Aucune ligne" }]), "Lignes");
    XLSX.utils.book_append_sheet(wb, clientsSheet, "Clients");
    XLSX.writeFile(wb, `Extraction_${from}_${to}.xlsx`);
  };

  const toggleRuleActive = (id) => setBusinessRules((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  const deleteRule = (id) => setBusinessRules((rs) => rs.filter((r) => r.id !== id));
  const saveRule = () => {
    if (!newRuleForm.label.trim()) return;
    if (newRuleForm.id) {
      setBusinessRules((rs) => rs.map((r) => (r.id === newRuleForm.id ? { ...newRuleForm } : r)));
    } else {
      setBusinessRules((rs) => [...rs, { id: "r" + (rs.length + 1), ...newRuleForm, active: true }]);
    }
    setNewRuleForm(null);
  };

  const FIELD_PATTERNS = {
    ref: ["ref", "sku", "reference", "référence"],
    model: ["model", "modelname", "modele", "modèle"],
    color: ["color", "colors", "couleur"],
    category: ["category", "categorie", "catégorie"],
    priceFR: ["frprice", "pricefr", "prixfrance", "francePrice"],
    priceExport: ["exportprice", "priceexport", "prixexport"],
    priceCH: ["swissprice", "chprice", "prixsuisse"],
    rrp: ["rrp", "prixconseille", "recommendedretailprice"],
    qty: ["stock", "qty", "quantite", "quantité"],
  };
  const CLIENT_FIELD_PATTERNS = {
    name: ["name", "nom", "raisonsociale", "société", "societe", "company"],
    type: ["type", "typecompte"],
    country: ["country", "pays"],
    typology: ["typology", "typologie", "segment"],
    contact: ["contact", "interlocuteur"],
    phone: ["phone", "telephone", "téléphone", "tel"],
    email: ["email", "mail", "courriel"],
    billingStreet: ["billingstreet", "adressefacturation", "ruefacturation"],
    billingPostalCode: ["billingpostalcode", "cpfacturation", "codepostalfacturation"],
    billingCity: ["billingcity", "villefacturation"],
    taxId: ["taxid", "siret", "nif", "vatid", "identifiantfiscal"],
    ownerRep: ["rep", "representant", "représentant", "commercial"],
  };
  const normalizeHeader = (h) => String(h).toLowerCase().replace(/[\s_\-().]/g, "");
  const guessMapping = (headers, patterns = FIELD_PATTERNS) => {
    const map = {};
    Object.entries(patterns).forEach(([field, pats]) => {
      const found = headers.find((h) => pats.includes(normalizeHeader(h)));
      map[field] = found || "";
    });
    return map;
  };

  const handleCatalogFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        setImportedRows(rows.slice(0, 1000));
        setImportMapping(guessMapping(rows.length ? Object.keys(rows[0]) : []));
      } catch (err) {
        setImportedRows(null);
        setImportMapping(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadImportTemplate = () => {
    const headers = ["ref", "model", "color", "category", "frPrice", "exportPrice", "swissPrice", "rrp", "stock"];
    const example = {
      ref: "MKNF03-CRST-TORT-GRN", model: "MILTON", color: "CRST-TORT-GRN", category: "Premium",
      frPrice: 30, exportPrice: 32, swissPrice: 34, rrp: 69, stock: 25,
    };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle catalogue");
    XLSX.writeFile(wb, "Modele_import_catalogue.xlsx");
  };

  const downloadClientImportTemplate = () => {
    const headers = ["name", "type", "country", "typology", "contact", "phone", "email", "billingStreet", "billingPostalCode", "billingCity", "taxId", "ownerRep"];
    const example = {
      name: "Optique Exemple", type: "prospect", country: "France", typology: "opticien",
      contact: "Jean Dupont — Acheteur", phone: "01 23 45 67 89", email: "contact@exemple.fr",
      billingStreet: "1 rue de l'Exemple", billingPostalCode: "75000", billingCity: "Paris",
      taxId: "", ownerRep: "Camille Dubois",
    };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle clients");
    XLSX.writeFile(wb, "Modele_import_clients.xlsx");
  };

  const handleClientImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        setClientImportedRows(rows.slice(0, 1000));
        setClientImportMapping(guessMapping(rows.length ? Object.keys(rows[0]) : [], CLIENT_FIELD_PATTERNS));
      } catch (err) {
        setClientImportedRows(null);
        setClientImportMapping(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const clientImportSummary = useMemo(() => {
    if (!clientImportedRows || !clientImportMapping || !clientImportMapping.name) return null;
    let created = 0, updated = 0, errors = 0;
    clientImportedRows.forEach((row) => {
      const name = row[clientImportMapping.name];
      if (!name) { errors++; return; }
      const exists = accounts.some((a) => a.name.trim().toLowerCase() === String(name).trim().toLowerCase());
      if (exists) updated++; else created++;
    });
    return { total: clientImportedRows.length, created, updated, errors };
  }, [clientImportedRows, clientImportMapping, accounts]);

  const commitClientImport = () => {
    if (!clientImportedRows || !clientImportMapping || !clientImportMapping.name) return;
    const today = new Date().toISOString().slice(0, 10);
    setAccounts((accs) => {
      let next = [...accs];
      let counter = next.length;
      clientImportedRows.forEach((row) => {
        const name = String(row[clientImportMapping.name] || "").trim();
        if (!name) return;
        const idx = next.findIndex((a) => a.name.trim().toLowerCase() === name.toLowerCase());
        const patch = { name };
        if (clientImportMapping.type) patch.type = String(row[clientImportMapping.type] || "prospect").toLowerCase();
        if (clientImportMapping.country) patch.country = String(row[clientImportMapping.country] || "France");
        if (clientImportMapping.typology) patch.typology = String(row[clientImportMapping.typology] || "other").toLowerCase();
        if (clientImportMapping.contact) patch.contact = String(row[clientImportMapping.contact] || "");
        if (clientImportMapping.phone) patch.phone = String(row[clientImportMapping.phone] || "");
        if (clientImportMapping.email) patch.email = String(row[clientImportMapping.email] || "");
        if (clientImportMapping.taxId) patch.taxId = String(row[clientImportMapping.taxId] || "—");
        const billing = { ...(idx >= 0 ? next[idx].billing : { street: "", postalCode: "", city: "" }) };
        if (clientImportMapping.billingStreet) billing.street = String(row[clientImportMapping.billingStreet] || "");
        if (clientImportMapping.billingPostalCode) billing.postalCode = String(row[clientImportMapping.billingPostalCode] || "");
        if (clientImportMapping.billingCity) billing.city = String(row[clientImportMapping.billingCity] || "");
        patch.billing = billing;
        patch.delivery = idx >= 0 ? next[idx].delivery : billing;
        patch.ownerRep = clientImportMapping.ownerRep ? String(row[clientImportMapping.ownerRep] || clientImportDefaultRep || "") : (clientImportDefaultRep || (idx >= 0 ? next[idx].ownerRep : ""));
        if (idx >= 0) {
          if (clientImportMode === "new") return;
          next[idx] = { ...next[idx], ...patch };
        } else {
          if (clientImportMode === "update") return;
          counter++;
          next.push({
            id: "a" + counter, stage: "Nouveau", lastContact: "Aujourd'hui", vat: "—",
            phoneCode: "+33", mobileCode: "+33", mobile: "", iban: "", bic: "", sepaMandate: "Non reçu",
            lat: 46.6 + Math.random() * 3, lng: 1.9 + Math.random() * 3,
            history: [{ date: today, label: "Fiche créée", detail: "Par import administrateur" }],
            ...patch,
          });
        }
      });
      return next;
    });
    setCatalogHistory((h) => [{ date: today, user: "Administrateur", detail: `Import clients : ${clientImportSummary?.created || 0} créés, ${clientImportSummary?.updated || 0} mis à jour` }, ...h]);
    setClientImportedRows(null);
    setClientImportMapping(null);
    setToast("Import clients appliqué");
    setTimeout(() => setToast(null), 3000);
  };

  const importSummary = useMemo(() => {
    if (!importedRows || !importMapping || !importMapping.ref) return null;
    let created = 0, updated = 0, errors = 0;
    importedRows.forEach((row) => {
      const ref = row[importMapping.ref];
      if (!ref) { errors++; return; }
      const exists = catalog.some((p) => p.ref === String(ref).trim());
      if (exists) updated++; else created++;
    });
    return { total: importedRows.length, created, updated, errors };
  }, [importedRows, importMapping, catalog]);

  const commitImport = () => {
    if (!importedRows || !importMapping || !importMapping.ref) return;
    if (!importCatalogName.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    setCatalog((cat) => {
      let next = [...cat];
      importedRows.forEach((row) => {
        const ref = String(row[importMapping.ref] || "").trim();
        if (!ref) return;
        const idx = next.findIndex((p) => p.ref === ref);
        const patch = {};
        if (importMapping.model) patch.model = String(row[importMapping.model] || "");
        if (importMapping.color) patch.color = String(row[importMapping.color] || "");
        if (importMapping.category) patch.category = String(row[importMapping.category] || "Non classé");
        if (importMapping.priceFR) patch.priceFR = Number(row[importMapping.priceFR]) || null;
        if (importMapping.priceExport) patch.priceExport = Number(row[importMapping.priceExport]) || null;
        if (importMapping.priceCH) patch.priceCH = Number(row[importMapping.priceCH]) || null;
        if (importMapping.rrp) patch.rrp = Number(row[importMapping.rrp]) || 0;
        if (importMapping.qty) patch.qty = Number(row[importMapping.qty]) || 0;
        patch.label = [patch.model, patch.color].filter(Boolean).join(" — ") || ref;
        patch.catalogName = importCatalogName.trim();
        patch.lastModified = today;
        patch.modifiedBy = "Import";
        if (idx >= 0) {
          if (importMode === "new") return;
          next[idx] = { ...next[idx], ...patch };
        } else {
          if (importMode === "update") return;
          next.push({
            id: ref.toLowerCase().replace(/[^a-z0-9]+/g, "-"), ref, photoUrl: "",
            priceFR: null, priceExport: null, priceCH: null, rrp: 0, qty: 0,
            stockStatus: "En stock", restockDate: "", expectedQty: "", productStatus: "Nouveau",
            collection: "Import", ...patch,
          });
        }
      });
      return next;
    });
    setCatalogHistory((h) => [{ date: today, user: "Administrateur", detail: `Import : ${importSummary?.created || 0} créées, ${importSummary?.updated || 0} mises à jour` }, ...h]);
    setImportedRows(null);
    setImportMapping(null);
    setToast("Import appliqué au catalogue");
    setTimeout(() => setToast(null), 3000);
  };

  const saveProduct = () => {
    const f = productForm;
    if (!f.ref.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    if (f.id) {
      const before = catalog.find((p) => p.id === f.id);
      const changes = Object.keys(f).filter((k) => before && String(before[k]) !== String(f[k]) && !["lastModified", "modifiedBy"].includes(k));
      setCatalog((cat) => cat.map((p) => (p.id === f.id ? { ...f, lastModified: today, modifiedBy: "Administrateur" } : p)));
      if (changes.length) {
        setCatalogHistory((h) => [{ date: today, user: "Administrateur", detail: `${f.ref} — modifié : ${changes.join(", ")}` }, ...h]);
      }
    } else {
      const newProduct = { ...f, id: f.ref.toLowerCase().replace(/[^a-z0-9]+/g, "-"), lastModified: today, modifiedBy: "Administrateur" };
      setCatalog((cat) => [newProduct, ...cat]);
      setCatalogHistory((h) => [{ date: today, user: "Administrateur", detail: `${f.ref} — référence créée` }, ...h]);
    }
    setProductForm(null);
  };

  const deleteCatalog = (name) => {
    const today = new Date().toISOString().slice(0, 10);
    setCatalog((cat) => cat.map((p) => ((p.catalogName || "Sans catalogue") === name ? { ...p, catalogName: "Sans catalogue" } : p)));
    setActiveCatalogs((cur) => (cur || catalogNames).filter((c) => c !== name));
    setCatalogHistory((h) => [{ date: today, user: "Administrateur", detail: `Catalogue "${name}" supprimé — références repassées en "Sans catalogue"` }, ...h]);
    setDeleteCatalogTarget(null);
  };


  const notify = (type, message, accountId) => {
    setNotifications((ns) => [{ id: "n" + Date.now() + Math.random(), type, message, accountId, date: new Date().toISOString(), read: false }, ...ns]);
  };

  const saveNewAccount = () => {
    if (!accountForm.name.trim()) return;
    const created = {
      id: "a" + (accounts.length + 1),
      ...accountForm,
      stage: "Nouveau",
      lastContact: "Aujourd'hui",
      taxId: accountForm.taxId?.trim() || "—", vat: "—",
      lat: 46.6 + Math.random() * 3,
      lng: 1.9 + Math.random() * 3,
      newForFrontdesk: role === "rep",
      ownerRep: role === "rep" ? "Camille Dubois" : (accountForm.ownerRep || "Camille Dubois"),
      history: [{ date: new Date().toISOString().slice(0, 10), label: "Fiche créée", detail: `Par ${role === "rep" ? "Camille Dubois" : "le front desk"}` }],
    };
    setAccounts([created, ...accounts]);
    setAccountForm(null);
    if (role === "rep") notify("fiche", `Nouvelle fiche créée : ${created.name} — à compléter (SIRET, TVA, IBAN...)`, created.id);
    openFiche(created);
  };

  const changeQty = (id, delta) =>
    setCart((c) => {
      const cur = c[id] || { qty: 0, offert: false };
      const qty = Math.max(0, cur.qty + delta);
      const next = { ...c };
      if (qty === 0) delete next[id];
      else next[id] = { ...cur, qty };
      return next;
    });

  const toggleOffert = (id) =>
    setCart((c) => ({ ...c, [id]: { ...c[id], offert: !c[id].offert } }));

  const cartItems = useMemo(
    () => Object.entries(cart).map(([id, v]) => {
      const p = catalog.find((pp) => pp.id === id);
      const price = priceFor(p, selectedAccount?.country);
      return { ...p, price, ...v };
    }),
    [cart, catalog, selectedAccount]
  );

  const byCategory = useMemo(() => {
    const groups = {};
    cartItems.forEach((i) => {
      groups[i.category] = groups[i.category] || { items: [], subtotal: 0 };
      groups[i.category].items.push(i);
      groups[i.category].subtotal += i.offert ? 0 : i.price * i.qty;
    });
    return groups;
  }, [cartItems]);

  const discountRateFor = (category) => {
    const cartCategories = Object.keys(byCategory);
    const rule = businessRules.find((r) => {
      if (!r.active || r.rate === "" || r.rate == null) return false;
      if (r.type === "Remise catégorie") return r.category === category;
      if (r.type === "Remise combo") return (r.categories || []).includes(category) && (r.categories || []).every((c) => cartCategories.includes(c));
      return false;
    });
    return rule ? Number(rule.rate) / 100 : 0.05;
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    Object.entries(byCategory).forEach(([cat, g]) => {
      const applied = discountApplied[cat];
      total += applied ? g.subtotal * (1 - discountRateFor(cat)) : g.subtotal;
    });
    return total;
  }, [byCategory, discountApplied]);

  const shippingRule = businessRules.find((r) => r.type === "Frais de port" && r.active);
  const shippingAmount = shippingRule && shippingRule.amount !== "" && shippingRule.amount != null ? Number(shippingRule.amount) : SHIPPING_FEE_HT;
  const shippingThreshold = shippingRule && shippingRule.threshold !== "" ? Number(shippingRule.threshold) : null;
  const shippingAutoEligible = shippingThreshold !== null && grandTotal >= shippingThreshold;
  const shippingOffered = shippingOffert;
  const shippingFee = shippingOffered ? 0 : shippingAmount;
  const orderTotalWithShipping = grandTotal + shippingFee;

  const sendToFrontdesk = () => {
    const categoryBreakdown = Object.entries(byCategory).map(([cat, g]) => ({
      category: cat,
      items: g.items,
      subtotal: g.subtotal,
      discountApplied: !!discountApplied[cat],
      discountRate: discountRateFor(cat),
    }));
    setQueue((q) => [
      { id: "o" + (q.length + 1), account: selectedAccount.name, rep: selectedAccount.ownerRep || "Camille Dubois", total: Math.round(orderTotalWithShipping), merchandiseTotal: Math.round(grandTotal), shippingFee, status: "nouvelle", createdAt: new Date().toISOString().slice(0, 10), items: cartItems, categoryBreakdown, desiredDeliveryDate, orderNote, isPreOrder },
      ...q,
    ]);
    notify("commande", `${isPreOrder ? "Nouvelle précommande" : "Nouvelle commande"} — ${selectedAccount.name} (${money(Math.round(orderTotalWithShipping))})`, selectedAccount.id);
    setCart({});
    setDiscountApplied({});
    setDesiredDeliveryDate("");
    setOrderNote("");
    setIsPreOrder(false);
    setShippingOffert(false);
    setView("dashboard");
  };

  const toggleRouteStop = (id) =>
    setRouteStops((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const repNav = [
    { id: "dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    { id: "crm", label: t("nav_crm"), icon: Users },
    { id: "commandes", label: "Commandes", icon: ClipboardCheck },
    { id: "catalogue", label: t("nav_catalogue"), icon: Package },
    { id: "bestsellers", label: "Data", icon: Award },
    { id: "agenda", label: "Agenda", icon: CalendarDays, badge: agendaEvents.filter((e) => e.date >= new Date().toISOString().slice(0, 10)).length + tasks.filter((tk) => !tk.done && isOverdue(tk.due)).length },
  ];
  const frontdeskNav = [
    { id: "file", label: "Commandes", icon: ClipboardCheck, badge: queue.filter((o) => o.status === "nouvelle").length },
    { id: "crm", label: t("nav_crm"), icon: Users, badge: accounts.filter((a) => a.newForFrontdesk || isFicheIncomplete(a)).length },
    { id: "sav", label: "SAV", icon: Bell, badge: savTickets.filter((s) => s.status === "ouvert").length },
  ];
  const directeurNav = [
    { id: "dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    { id: "crm", label: t("nav_crm"), icon: Users },
    { id: "carte", label: "Carte", icon: Map },
    { id: "equipe", label: t("nav_equipe"), icon: Users },
    { id: "frontdesk-view", label: "Front desk", icon: ClipboardCheck, badge: queue.filter((o) => o.status === "nouvelle").length },
    { id: "bestsellers", label: "Data", icon: Award },
    { id: "agenda", label: "Agenda équipe", icon: CalendarDays, badge: agendaEvents.filter((e) => e.date >= new Date().toISOString().slice(0, 10)).length },
    { id: "config", label: t("nav_config"), icon: Settings },
  ];
  const adminNav = [
    { id: "catalogue", label: "Catalogue produits", icon: Package },
    { id: "import", label: "Import en masse", icon: FileDown },
    { id: "config", label: t("nav_config"), icon: Settings },
  ];
  const masterRepNav = [
    { id: "equipe", label: "Mon équipe", icon: Users },
    { id: "crm", label: t("nav_crm"), icon: Users },
    { id: "agenda", label: "Agenda équipe", icon: CalendarDays },
  ];
  const nav = role === "rep" ? repNav : role === "masterrep" ? masterRepNav : role === "frontdesk" ? frontdeskNav : role === "directeur" ? directeurNav : adminNav;

  const filteredBestsellers = BESTSELLERS.filter(
    (b) =>
      (bfReps.length === 0 || bfReps.includes(b.rep)) &&
      (bfTypologies.length === 0 || bfTypologies.includes(b.typology)) &&
      (bfCategories.length === 0 || bfCategories.includes(b.category)) &&
      (bfClient === "all" || b.client === bfClient)
  );

  const filteredHistory = selectedAccount
    ? selectedAccount.history.filter((h) => {
        if (historyPeriod === "all") return true;
        const days = { "7j": 7, "30j": 30, "trimestre": 90, "annee": 365 }[historyPeriod];
        return (Date.now() - new Date(h.date).getTime()) / 86400000 <= days;
      })
    : [];

  return (
    <div className="proto">
      <style>{`
        .proto {
          --bg: #F6F7F5; --ink: #101828; --ink-soft: #5B6472; --line: #E4E7E2; --panel: #FFFFFF;
          --teal: #32615F; --teal-soft: #E4F1EF; --gold: #C9A227; --gold-soft: #FBF3DD; --danger: #B4472F;
          --butter: #F0C860; --butter-dark: #A9791A;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink); background: var(--bg); display: flex; min-height: 660px; max-width: 1000px;
          margin: 0 auto; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; position: relative;
        }
        .proto * { box-sizing: border-box; }
        .sidebar { width: 210px; background: var(--ink); color: #D8DEE9; display: flex; flex-direction: column; flex-shrink: 0; }
        .brand { padding: 18px 18px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: flex-start; }
        .brand-mark { width: 110px; height: 38px; display: flex; align-items: center; justify-content: flex-start; margin-bottom: 10px; }
        .brand-mark img { width: 100%; height: 100%; object-fit: contain; }
        .brand-name { font-size: 13px; font-weight: 700; color: white; }
        .lang-switch { display: flex; gap: 3px; }
        .lang-switch button { background: rgba(255,255,255,0.08); border: none; color: #B7BECB; font-size: 10.5px; font-weight: 700; padding: 3px 6px; border-radius: 3px; cursor: pointer; }
        .lang-switch button.active { background: var(--teal); color: white; }
        .role-switch { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .role-switch p { font-size: 10px; color: #8892A0; margin: 0 0 6px; }
        .role-btn { width: 100%; text-align: left; background: none; border: none; color: #B7BECB; padding: 6px 8px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .role-btn.active { background: rgba(50,97,95,0.14); color: #7FB3AC; font-weight: 700; }
        .nav { flex: 1; padding: 10px 10px; }
        .nav button { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 5px; background: none; border: none; color: #B7BECB; font-size: 13px; cursor: pointer; margin-bottom: 2px; position: relative; }
        .nav button.active { background: rgba(255,255,255,0.08); color: white; font-weight: 700; }
        .nav-badge { margin-left: auto; background: var(--gold); color: #3A2E05; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px; }
        .user-chip { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11.5px; color: #8892A0; }
        .main { flex: 1; padding: 24px 26px; overflow-y: auto; }
        h1.page-title { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
        p.page-sub { font-size: 13px; color: var(--ink-soft); margin: 0 0 22px; }
        .cards-row { display: flex; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }
        .stat-card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; flex: 1; min-width: 150px; }
        .stat-label { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 6px; }
        .stat-value { font-size: 22px; font-weight: 800; }
        .progress-track { height: 6px; background: var(--line); border-radius: 4px; margin-top: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--teal); }
        .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 18px; margin-bottom: 16px; }
        .panel h3 { font-size: 14.5px; font-weight: 800; margin: 0 0 12px; display: flex; align-items: center; gap: 7px; }
        .task-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
        .task-row:last-child { border-bottom: none; }
        .search-bar { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
        .search-bar input { border: none; outline: none; flex: 1; font-size: 13.5px; }
        .account-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 4px; border-bottom: 1px solid var(--line); cursor: pointer; }
        .account-row:hover { background: #FAFAF8; }
        .account-name { font-weight: 700; font-size: 13.5px; }
        .account-meta { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .stage-badge { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px; background: var(--teal-soft); color: var(--teal); }
        .typology-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px; background: #EFECE2; color: #6B5B2E; }
        .cat-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .cat-tab { padding: 7px 13px; border-radius: 16px; border: 1px solid var(--line); background: white; font-size: 12.5px; cursor: pointer; }
        .cat-tab.active { background: var(--ink); color: white; border-color: var(--ink); }
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
        .product-card { background: white; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
        .product-card img { width: 100%; height: 100px; object-fit: cover; display: block; }
        .product-body { padding: 10px 11px; }
        .product-ref { font-size: 10.5px; color: var(--ink-soft); }
        .product-name { font-weight: 700; font-size: 13px; margin: 2px 0 4px; }
        .product-price { font-weight: 800; font-size: 14px; }
        .product-stock { font-size: 10.5px; color: var(--teal); margin-top: 3px; }
        .qty-row { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
        .qty-row button { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--line); background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .qty-row .qty { font-weight: 800; font-size: 13px; }
        .cat-block { margin-bottom: 18px; }
        .cat-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .cat-head h4 { font-size: 13.5px; font-weight: 800; margin: 0; }
        .toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft); cursor: pointer; }
        .switch { width: 32px; height: 18px; border-radius: 10px; background: var(--line); position: relative; }
        .switch.on { background: var(--teal); }
        .switch.gold.on { background: var(--gold); }
        .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: left .15s; }
        .switch.on::after { left: 16px; }
        .line-item { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 6px 0; color: var(--ink-soft); gap: 10px; }
        .line-item .toggle { flex-shrink: 0; }
        .offert-badge { font-size: 10px; font-weight: 800; background: var(--gold-soft); color: #8A6A0E; padding: 2px 7px; border-radius: 8px; }
        .cat-subtotal { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; padding-top: 6px; border-top: 1px dashed var(--line); margin-top: 4px; }
        .grand-total { display: flex; justify-content: space-between; align-items: baseline; padding: 16px 0; font-size: 22px; font-weight: 800; }
        .btn { padding: 11px 18px; border-radius: 6px; border: none; font-size: 13.5px; font-weight: 700; cursor: pointer; }
        .btn.primary { background: var(--butter); color: #3A2E05; font-weight: 700; }
        .btn.primary:hover { background: #EBC04E; }
        .btn.outline { background: white; border: 1px solid var(--line); }
        .queue-card { background: white; border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .queue-status { font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 10px; }
        .queue-status.nouvelle { background: var(--gold-soft); color: #8A6A0E; }
        .queue-status.importée { background: var(--teal-soft); color: var(--teal); }
        table.reps-table, table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.reps-table th, table.data-table th { text-align: left; font-size: 11px; color: var(--ink-soft); padding: 8px 10px; border-bottom: 1px solid var(--line); }
        table.reps-table td, table.data-table td { padding: 10px 10px; border-bottom: 1px solid var(--line); }
        .config-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid var(--line); font-size: 13px; }
        .config-row span.desc { color: var(--ink-soft); font-size: 12px; }
        .filter-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-row select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 5px; font-size: 12.5px; background: white; }
        .confidential-note { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-soft); background: #F3F1EA; border: 1px dashed var(--line); border-radius: 5px; padding: 8px 10px; margin-top: 8px; }
        .stop-chip { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 5px; margin-bottom: 6px; cursor: pointer; background: white; }
        .stop-chip.selected { border-color: var(--teal); background: var(--teal-soft); }
        .modal-overlay { position: absolute; inset: 0; background: rgba(16,24,40,0.45); display: flex; align-items: center; justify-content: center; z-index: 30; }
        .modal { background: white; border-radius: 8px; padding: 22px; width: 380px; max-height: 85%; overflow-y: auto; }
        .cc-field label { display: block; font-size: 12px; color: var(--ink-soft); margin-bottom: 4px; }
        .cc-field input, .cc-field select { width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 4px; font-size: 13.5px; margin-bottom: 10px; }

        /* ===== Responsive : tablette et mobile ===== */
        @media (max-width: 900px) {
          .proto { max-width: 100%; border-radius: 0; min-height: 100vh; }
          .stat-card { min-width: 130px; }
        }
        @media (max-width: 680px) {
          .proto { flex-direction: column; }
          .sidebar { width: 100%; padding-bottom: 0; }
          .brand { padding: 14px 16px 10px; }
          .role-switch { padding: 8px 14px; }
          .role-switch .role-btn { display: inline-flex; width: auto; margin-right: 6px; padding: 5px 9px; }
          .role-switch p { display: none; }
          .user-chip { display: none; }

          /* Barre de navigation mobile, façon app native : icône + libellé tronqué proprement,
             zone de appui large, indicateur actif en pastille pleine (pas juste un trait discret). */
          .nav {
            position: absolute; bottom: 0; left: 0; right: 0;
            display: flex; flex-direction: row; align-items: stretch;
            background: #0B121E; padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
            z-index: 15; border-top: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 -4px 16px rgba(0,0,0,0.25);
          }
          .nav button {
            flex-direction: column; justify-content: center; width: 0; flex: 1 1 0;
            gap: 3px; font-size: 10px; line-height: 1.15; font-weight: 600;
            padding: 7px 3px 6px; min-height: 52px; text-align: center;
            margin-bottom: 0; border-radius: 10px; color: #9AA4BC;
          }
          .nav button span, .nav button { 
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
          }
          .nav button.active { background: rgba(50,97,95,0.16); color: #7FB3AC; }
          .nav button.active::before { content: none; }
          .nav-badge {
            position: absolute; top: 2px; right: 14%; margin-left: 0;
            min-width: 16px; height: 16px; padding: 0 4px; display: flex; align-items: center; justify-content: center;
            font-size: 9.5px; border: 2px solid #0B121E;
          }
          .main { padding: 18px 16px calc(88px + env(safe-area-inset-bottom, 0px)); }
          .cards-row { flex-direction: column; }
          .stat-card { min-width: 0; }
          .modal { width: 92vw !important; max-width: 380px; }
          .product-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
          table.data-table, table.reps-table { display: block; overflow-x: auto; white-space: nowrap; }
          .filter-row { flex-direction: column; }
          .filter-row select, .filter-row input { width: 100%; }
        }
        /* Au-delà de 5 onglets, les libellés longs (anglais/espagnol) passent en icônes seules
           pour garder une barre lisible plutôt que de tasser du texte illisible. */
        @media (max-width: 680px) and (min-width: 481px) {
          .nav.nav-dense button span.nav-label { display: block; }
        }
        @media (max-width: 480px) {
          .nav.nav-dense button span.nav-label { display: none; }
          .nav.nav-dense button { min-height: 46px; }
        }
      `}</style>

      <div className="sidebar">
        <div className="brand">
          <div>
            <div className="brand-mark"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnQAAADaCAYAAAAv4N94AAAxOElEQVR4nO3debidVXn38e85SQhhErVOgDQGcRbRUiBAIFC12tpSrCAIVmxfqyiByCTWsbZWEIQE0FprrROKiFR9HXCCQAgZoIpSWkHFoPBahyoKEjKe9491drOzs9d6hr3GZ/8+13WuJHufs9adffZwP2u418R9q05GJLDjgU+mDkK8mUgdgIiIbGsydQAiIiIiMholdCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldCIiIiKFU0InIiIiUjgldBLDhtQBiIiIdJkSOolhh9QBiIiIdJkSOolhS+oAREREukwJncSwKXUAIiIiXaaETmLYmDoAERGRLlNCJzHMSR2AiIhIlymhkxh2Th2AiIhIl81MHYCMheuANdN/3wjMAtZjNktoB2zeNgGz2bqxZUXCWERExEIJncSwFjgodRAiIiJdpSlXERERkcIpoRMREREpnBI6ERERkcIpoRMREREpnBI6ERERkcIpoRMREREpnBI6ERERkcIpoRMREREpnBI6ERERkcIpoRMREREpnBI6ERERkcIpoRMREREpnBI6ERERkcIpoRMREREp3MzUAYhk7kTg4cDLMRdAB7RsZwuwevrP9wGbgCt9BCgiIjJx36qTdwJeBGwE5gATwHrMh9csYLOHfjZgkseZwEPT/awFVnhou6sOBebi5/F32QTsgEk0NgFXBe4vV/OBNwDPBOYl6H8t8DngU8DKBP2LiEjBJu5bdfKJwMcT9b8z8GCivnM2D/hBor4nEvUb2/OBt2IS51xdCZwN/Ch1IIEtwSTUsO0FzBZghof2TwTu8tBOajcCjwB+hrko3szor9fexdz9020/MP3vjcDu07fPBI6cvq2JucAnR4xP3KYwz4EpzADMCmBxwP5u6usPqp9/k8A6zHNoZ+DXmOfVz4F3AdcGiTJPS4HTAra/cCbwy4AdVLkGODxh/7lKlcx13emY5KEUx01/gUnqjqebo3enB25/PmUndLtgEquep0bu/zKaJ3MAzwYO9hyLuB1A2IRufvW31PZcxmcAAeDAwO0/ahLYI3AnLguA3RL2n6PHpQ6gY47HTCVPUVYyN2hvzNXxFCbhf0zacIrSJhnJyf3V3xLMb4FFLX92J5+BSCdNVX9LZ6wP3P7sSeAXgTupck3i/nPz/1IH0AETwHsxbxafxM+0XU7mAf9N+UmqVEv5gbceMzrYVumJtMTxq9QBRDI7cPszJzHz2SnNB/ZMHEMunpg6gMLNZutO0tcmjiWW0zEf+p9NHEfOSp0F2JCw798AOybsX8bH7sDNqYOIIHiZuEnSDuf3fDR1AJm4I3UAheolcg8Rfp1Cro7GJHbLEseRo9+kDqCFpZhF7qn4WPqhOqdS1wHAhamDCCx0xYr7JzE7T1I7irRvXjnYC70BtnEj453IDToCk9gtTR2ItHYpYXfDVZnAT/WBTR7akPFxJn43XeQm9Othh0nyWedwfeoAEvt+6gAK80pM4pJz2ZGUTsM8PgelDkQaOQ44NWH/PncdqnC9NHUT3X1PDz5gk9MLbj5m8XroYckc7U34BZNdMYu0a4tKs2r6q8tXvl2xH6awdCoqISU5uJHxKmfiTW5TfMtTB5DI3akDKMTrUTLXxsGY0boFqQMRq/nAtxP2/0LG9/1X8jNO5Uy8yS2hm89o2+RLtG/qAApxD3BR6iAKdwPaDZurmxL2/TxUPkryozWYDeWW0AFclzqAyO5MHUDmZmGu1lTaxo+jMcsaVPQ1HylHIy4Bvp6wfxGbGcAXUgdRkhwTugPoXiFYm2emDiBzB6Ap1hAmMScAjMvrLFf9Z2KmcDHhj10TGcUfox37teWY0AF8LXUAkdyQOoCMLWE8ik2mtAlYmDqIMZaywsD5wBkJ+xep6zRMaTOpkGtCd2TqACLYk/SndORqKRo5iOU6ulsmIGdTpBshvQM4N1HfIm18A5ibOojc5ZrQQfdHr36YOoBMvZe0RVXH0Y2oMHNM1ybsewvwlIT9i7T1Q1TeyynnhG4B3f3lzUUnYwxzHuNzBmtuVqOyJjG8k7QzEFo3KSV7KHUAOcs5oQPz5tdFOhViexcBb0gdxJi7ASV1Ib0T+JuE/atYq3SBatRZ5HRSxDBnAmelDsKzJ6Or5EEvxxQNLsVyzIaCL2OKQs9k2w/LSWAHzCjsSdP/LuWkhhswdclUysKvQ1EyJ+LLF4AXpQ4iN7kndGAOql6UOgiPUlaDz9H+wEdTB2HxE+CfgSuB21u28f4htx0F/BHmgiVHX0MJgE/zMesUU9k1Yd8iIfwx3csNRpb7lCukPajatyfT3XWBbcwAvpU6iAFXAXtgEpo9gLfRPpmzuRYz8jwx/XUI8HHPfYxK0xp+HEraUyCeAjyQsH+RUE6lnJmPKEpI6MAslu8Cjc5tK5ejXf4LczD6BHAsZmQuppWYaecJzLmruViWOoDCzSHtyNzBmBIlMj7Wpg4gspQXS9kpJaHrwmL5eWh0rt+XUwcArMEsO3gacFviWHpWYxK7mZhEL6UjgJckjqFUs4EHE/Z/EOa51GUT+tru6wkjPaJlSlnTMSulJHQA704dwIj+M3UAGfkT4AUJ+1+Oee4fhDnXNEebMVOx+ySO49Po3Nc2UpZXeCnmYkVkXOQy25NUSQnd2akDGMHeaHSu3+cT9v1o4HDKWSN2F+bK+88SxvDbhH2XKOWHy1LMJh6RcTP2SV1JCR2Y8z1LdHfqADKSahroKkxi9PNE/Y/qc5j4703U/9sS9VuaDaSb/jkPWJyob5HUZgD/mDqIlEpL6Eo833Pf1AFkZB5pjphaiNns0AV7Aeck6PftCfoszYdJdwLMdcAbE/UtkovXMMbnFJeW0EF5a+nuTB1ARn6QoM8dgOsT9BvSBZj1dbH9e4I+S/EB4BUJ+z8qYd8iOXkXcEDqIFIoMaEraS3dM1MHkJGXRe7vAWBHYGPkfmNZiUlWY3oO8NTIfZbgPOBVCftXEWiRbd3MGO58LTGhg3Lq0t2QOoCMXB6xr/WY6vjrI/aZwkZM0hqTailu6wjSllVSMicy3CZgl9RBxFRqQldCXbo9gd1TB5GJiyL3FzvJSWk9cY/wmwU8MWJ/OTuQtMWXx+l5LtLGr1MHEFOpCR2Yc9xydk/qADLy+oh9lfycbmszcFjE/lRT0WxOSVm4d0e6PwItMqpJ4Gepg4il5A+/nM94nZs6gIz8VcS+Hks59eV8WwGcEamvWYz3c3w28OOE/U+gZE6krkcBH0wdRAwlJ3QAF6YOwOITqQPISKwX0jnATyP1lauLMYWIYxjX3duPIO0pEDmd9StSir8CjkkdRGilJ3Rnpg5giF2A+amDyESstVb3Ykp5SLyjwlLVW0vtfxL2fTjdP59VJJSrgQWpgwip9IQO8ltL9+nUAWRkWaR+fjdSP6XYL1I/SyL1k4uU0/mHYM4gFpH2Ol15ogsJXU5r6R5F2kPnc7NnhD7egtkUIFvdRpwjwko8uaWtlNOsl2DqDorI6Dq7zroLCR3kU5fu46kDyMhfR+rn7yP1U5rHR+pnHIpnX4TZCJHCZYxX4iwSQyeTuq4kdDnUpZsFPD91EBmJcUjyiRH6KNUUcaboun5u4lLilt3pdwWwKFHfIl23LHUAvnUloYP0a+luStx/bmI8t7Sb2O3wCH3EPtItpnOB0xL2f0LCvkViWxO5vyMo72x4py4ldCnX0u3EmB4GbBFj9/FJEfroglsj9BFrE0ZMCzGHfKeiI71k3Kwn/vP+bOCoyH0G06WEDtJNwX0pUb+5ilEfMObZsCX7owh9nBWhj5jmA9cl7F/JnIyjOdN/7hC532/QkVJjXUvoUmxKmMAM3Uo870sdQEF+EqGPl0foI5ZZpF0+0bX3ZJG6tkz/uRF4RuS+b6IDF1Ix3jxib1iI/eFyfeT+cvfUCH10bUQotItTB1CIOcCGhP1P0NHddyI19Jefup34p6Jsqf6WvMVI6O4i7mLHj0bs6xHErTz9pIh9tfXKCH2si9BHl8Q443X/CH2ENAN4MGH/v5Owb5EcDI6QrSb+CUAp3wNGFmt4/3mR+umJVQPt85H6AXP18r2I/bUVOqF7S+D2pZ0YiXxIv07Y92GkPVJMJAfDRqfPIe6A0Bzgxoj9eRUjoZsN/Ia4lc7/KUIfM4BDI/TTMy9iX6MIPdKwJHD7XbU0cPsvCtx+SJuAnRP1vRBYkahvkZxsstx+EHGnQw/FFBMvToyErjc9dmSEvvodF7j92GvnfhS5v1w9kDqAQoXeeZzzBccsx313Yy7OUjgcrcEV6XG9TneJFoXxekwiWZQYCd3Dp/9cD1wbob+eTwVsO/bo3D4R+xpF6BeAktr27kkdQEK2NZcXAnvHDKTPZcQ5yaPLpvT1v19dLvAN5jUcexfqKuKcR+5NjITuZ31/jz0tE2rH67cDtTvMLZiNJSUIPd0ac82iNJfrtv9dh9y2lDgFsId5DzrSS/xKuQY0psMi93cP6UbwG4uR0D2m7+/riLteJMSO112Apwdo1+bAiH2N6s2B278icPtdF3pxca6nd/x24N8vJt2RXu9HZXfEv8emDiCSFcR/7drW9mUnRkJ338C/Y2fYL/Hc3jc8t+eykrLqUoWOVYvHR/OZwO3nWk5mdt/f9yf842DzC+CURH1Lt/0idQARXQpcFbnPIsqZxEjohu1OiVnp/9Me25pD3BGzP4jYlw+dOD6lw24P3H6MendtbJz+8yDgWwnjeFTCvqXbXBsKuuhY4JcR+5tDAUt+YiR0w9avvC5Cv/187Xi9wVM7ddxGviMeUqYvBm5/p8Dtt7UJsw5mVaL+f0u+6wulG2amDiCBR0bu70+A90bus5EYCd39lttjHkfkY8frLsABHtqpa7+IfYn4kGtJmX1Iuw4mdskFkXER+yLytWR8dnuMhM525RB7embUbd3XeYmiHh0+vz2tn8tf7LMX63p3wr5TFSyW8RLr1KfcrCP++84yzBRsdmKdFGETc5Tu8hF+difijs7FnpIuQfEHJ4+BYrb3R7IrhSymFinYauDkyH0+SIZLTFJtiuiJPUrXti7dl7xG4XZJxL5EJJw3pQ5AZEx8hLgDRLB9OaTkYiR0myvuPz9CDD1t6tJNEHfO/PSIfZVEI3RSmnPRzm+RWM4g/jrehyL355TDvPu5kftrOkoX86zFEyP2VZqqCwORHN1ExouoRTpmWFWNkGaTdo3uNnJI6AAuiNhXk1G6RwALQgUyxCci9lUalX2QUi1DSZ1ILLFLuJxNJkf55ZLQnRO5v7qnR8QsJHhsxL5KNC5H20g3LSPuxiqRcbUZeHTkPi8hg9d3jISubh9Lg0axrTqnR8wADg0dSJ/YR5mUZl7qAKRSzOUJJbqZuO8pIuPq58Ahkfu8OXJ/20m9y7Xf4pBBDLFnxf3Lo0RhvDRiX6Vylb+RPOh3VO1G4h4fKONBm8a2t5K4A0VgzjO3LQ8KfjxbLlOuPSdE7Osex32zibs77cqIfcn4irkeVOxWA/unDkI6RTUgh1sM/CRyn7bkOnjSnVtCd0Xk/uZabo95Zus+EfuS8fb4wO1fGrj9LvkW9vcfkaamUgeQsT2IP4L5gyG3Bd+skVtCB3GnH7875LY5xJsS2QLcFamvLnhi6gAK17awdl2acm3mh+gxEz82pA4gcztG7m8e8IGB28ZuhA7iTj/OBp46cNuyiP0/JWJfMYRed/iCwO13XejHr03h7nH3EPDI1EFI8WLXXyvNRuKXM3kV8Iq+f68P3WHs/2Bdfwl8KFJfNwO79P075oLl70XsK4a7CbtO60TgsoDty2hU/LmdX2DOhVyXOpDCHEuegxIxzcSsn/tY6kAKsBk4DLMxKZYPY9bwfZUIz9VcE7p/JV5CtzPwdOB24KJIfUL8OjkxXA+cFLD9gwO23XXZHSQt23gQ2AEzkiD1qNSTNLUCeD/wmoh9fgXz2h67Xa79Yu54/db0n6+P1N83MXVyuuaDqQMQq1cFbj/4dMIY2IBZwysi4ZxC/FOZNhChOH7OCV3MHa+ziLt2LnbBwy6JlXR3zeLA7cfeod5VD6ISFCKhnUj8i9C9Q3eQc0IHcHLEvmKdtXgdGs0YxdmpAyjU3MDtfyNw++NkU+oARMZA7J2vweWe0H0kdQABvCh1AIHdErj9xwVuv4ueE6EPLcr2S3XFRMLr1Nri3BM6MEOjXbEcM6XSZe+J0MfxEfrokk+lDkBaUVInEtY64PdTB+FLCQld7MWLIR2eOoAIPhOhj8sj9NEloQsyfz1w+7GdRz5X7ioFIxLWLcCfpw7ChxISOuhGAd73pw4gkhhlFybRwvG6/jZCH38foY9YNgJvxFy555DUTaKROpHQrsZcyBWtlITuDuCB1EGM6JTUAUT01Qh9XBehjy54a4Q+ro/QRyw79P19HaZOZQ6U1ImE9cbUAYyqlIQO4IDUAYwgxrqynFwcoY8FaJSuyksi9BH70OuQJobc1iv4mwPtfhUJa9h7QDFKSujuSB3ACM5KHUBk10Tq54JI/ZTq0xH6OCNCHzG4kraN5LFwegZK6kRCKykv2kZpgT8+dQAt/EXqABKJkYB3JZkIIVYB5qWR+glpR6rXft4CHBQhlioz0PSrSEhTwO+lDqKN0hK6e1IH0MK41uc6OnD7RQ+NBzZBnHOJu3Du6A7UL/S9BlgYLpRGVMhZJJxvks9rvbbSEjqAfVIH0MDJqQNIKOQInZI5t9DFnXv+IFI/oTyL5knp9cB+AWJp6ijgwtRBiHTY9RS2rKfEhO6u1AE00MWTLpoIsRlEyZzbQuKcDAGmUHapFgLfafmzt5FHTckzgUtTByHSYedQ0Pr9EhM6gH1TB1DDq1MHkAGfm0E2o2Suyi7EK+dScu25wxi91Mpy4DIPsYzqVODdqYMQ6bBi6uCWmtB9n/zLJXwgdQCZWOWpnZme2umy+yP29ZaIffn0JmCFp7YWkcemkLOBJamDEOmwXVMHUEepCR3ksY7FpoQRxFgOGfHnt6CRuTpilrOIVZbGt4uBf/Dc5mLyOAXmdJTUiYTyAAUMKpSc0N1OnuccbsGMIIoxRftF+ptR8eA6lhH3cXpxxL58WUq4MjenkMfi6dPR9KtIKJsxyzWyVXJCB/EWfzdR0i7cWNouIM/+iigDNwFHROzvMsyRWCVZiRlJC+kc8lhmcTbaKCESygryWDs7VOkJ3Xfwtx7Gh/XA2tRBZGgdzUbpNM1az6+B+ZH7XBS5Px/+JVI/ryZeyRiXU4GXpQ5CpKMWkekO/9ITOoDnpw6gz6NTB5CxuqN069E0ax1TwG6R+zwncn++/DpiXzkcEQZwOXBo6iBEOupwMpyp6EJC9yB5jNKtAH6TOoiMrcPsMKyyY+hACncM6Y5+ymGdWAkmqH/6REg3ksdxZSJdtFPqAAZ1IaEDeEHqAMh8sWQmqnYYaprVbjZwLXB1ov6fnahfHx6WoM8dyWPT1iqU1ImEktVnVlcSugeAbyfsf9QipePEtmkkqxdGZi4FHgKOTNT/vwK3Jurbh5hTrv1y2dSzirgbZ0TGyailubzpSkIHsH/CvlN90JboLrYvH6FkbrjTMdOrpyaO4y8T9z+qOQn7zuW5vYz4G2hCm9LX0C+JayXwutRBQLcSOjAPbGxXoRdRUxdP/5nDbtabyKt212zMiNwUeRSKTf378SH1erZcHsObSHvhK9JV7wMuSR1E1xK6FCNlxyboswsmSL+bdQozanH29N//B3hzgjh2w2yF34yZWk09ItdzcuoAOiSXpO5bwILUQYh00Okk3hjZtYRuPbAmYn/nR+xL/Bo2qvoI4O/YOnVxA3BcgL4ngOMxI8pTmDVel5DX63El8JHUQXRMLju4byDtNLRIV6XYgPW/clm069MhxDvX8txI/YhfdXcfLpj++lTfbWsxR7t9H1Ncsuq59hxMbbLnALs3CTKxbBb6dsh6TDKfwxKNB8ln1FCkS5K9xruY0G3GfNCGnla4uPpbJEOjvtDmTn89F3jNqMFkSh/0YU1i1o+mNoWppZVdgVSRwv0h8JXYneY0xeNT27NDmwh10LeEsyF1AAXIrlhmB02Rz3vvg6RfyyrSNV8F/jx2p7m8qYTwvoBtvzhg2xLGFDArdRCZ2wGN1sQyBSxMHcS0WEtURMbJ1cB5MTvsckIXsi7MvwVsW/zTB1a1mcDG1EGMmeuBg1MHMU0XPCL+vRG4PVZnXU7oAJYGaPMvArQp4UyhKaUqDyOPY6rG0WryKUy+Aa2fFPHtGbE66npCtzhAmx8L0KaEkcNuwpxtxHyAJ62dJCwjn/NWcyj2LdI1D4/RSdcTOoDLPLZ1gse2JCwlc27LMWvmJA9riLOZq44cduCKdMl92M8x92YcErpFHtu6wmNbEo6mD93OIp/kQbZaTphZhTZ0QSTi110Eft8dh4QO4D0e2vgdD21IeDmVhMjRM/DzepAwlhJ2h34TSupE/FoOvD9U4+PywXfWiD9/H+acT8mb6szZfQyzNirajitp7XXAP6QOYppeUyJ+nYLZ4e7duCR0MNrJDkd4i0JCUdkFuyeh3dmleRN+1/+2NQuV/RHxbWGIRscpoTsDM0LR5us7CeKV+vSBM9wizPP3e6kDkVYWAR9IHQSm7I+mX0X88n706kzGK6mT7pmF6swNugLtyO5XcsL/6uk//zppFMYUzUqaaLesNPFA6gAi24zJwby9P02iNRJStl4tNSUwZsHtw9BjMShKDaiAXk0+H3ZNRuo0WCBN7JY6gAQ242/n64ZJYI6nxkRSugKT2D0D+GniWGK7APN/PxwVCR7mV6kD8GBX8knqLqz5fRo5lybG9ejB5Yy+cRNg5iRwp4eGXO4K3P64+XHqADJ3O/BYYCfyWFQeynrMkVETwDmJY8ndrqkD8GRX8qixeCZwaY3vezB0ICId8R5GPyN+9kzMWYI66qUce6cOoBDrMIvKFwHzgHcBxyWNaHQbqf9hKlutTx2ARzOBh4DZieM4FTOl+jrH9/wHsCJOOGNrFuZ9YRPmOXFL4P5uYesyFxj9AmMSE/d6un0BXseLgS8Ae2KWwm2h3uM7C/O+sHzivlUnB4tOJENzgL8B3kgZU0LLMW90V6YORERE8qVFqzJu1gFvwVzRTGBqtL0KuDVhTP1uwVyp9UrmHI6SORERqaAROpHt7Qa8AFNQ+gBgd0zi58v3MZsXPgrcC1zlsW0RERlDSuhE/DgQ2BczRfqjxLGIiMiY8V6pWGRMrZn+EhERiU5r6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHBK6EREREQKp4ROREREpHAzR/z5OcAxwAuBJ07fNjX95w+Aa4CrgXUj9iNbHQ88BngpMIF5vB8CdgX+FfhvzGMuksqTgacDxwLzgPWYi8edgb8D7gBuTxadiEgHtRmhOwq4G5NIPAhcDpwEHDz9NX/66yTg49PfMwV8dvRwG7touu+mXzcClwIHxQ95O7ux7f/jk8ASzGPce7yPBA4A3gt8pu97Lwf2jR6x3afZ/rG+O2E89wyJp/+r7WN3oKW9lSPGO0zvtTj4FdsC4EfTfX8X8zw8HvNYLAAOBfafvv0/pr9vSYI4Q2nzPuP6+uGI8cyqaP+J9h8dqd1RHV3Rfpuvd3mIq/fcHvy6sEVbvh67sy3tLGnR1qAFjjjbfv3AQ1xtnGiJJ5Ullniqvm4CPoXJwYaauG/VyXWDeDHmzXhUXwX+0EM7dfj6pZ0PnOuprSZuBZ7lqa0dgI2e2mpjT0wCNcxEzED6VD0/fgvs0qLdVwAfHnL7GvxfJNj+D7Ee09diLiRGcQJwhYdYUjkQWB2g3VF/h1XP7zbtu9p8KXBlizb73YBJJny6Bfj9Edtw/b+bPI7vwv5ZMlnRzyDb9+4B/KRBO8OcSbtk1eVeYC/PbdZhe5xOwgx6xLYa854xqlWY5O5/Z0DrjNDtjXlAfCRzAM+fbi/Vh3gbbyBuRn/VdH++kjmADfh5ErVlS+YATo0WRTM7Y57/TR1ruf3rI8SSm3mY5+ioyRyYUWffHx4xzQvQ5loPbVR9eDaN+1uO+65i9GQO/Cdz4GfEytfoumtg4C8atPNKx32jJnMAx3loY9BdAdqs4krY3hEtim35+hw+GDMD+tzeDVUJ3TGEmxLbEqjdkEIndb01cX8eqP0Qowh1HFNxf4rRz7oXFG2e/4dabv/3Fm25zPfcXl1vxv/0SYgRgVhOD9DmnR7auBfY7Lj/uw3aOhczZW5ju4jJgetisq7bPLRxTsX9f9CgLduF1KsatOHyu57a6fe+AG26zAZe5rg/xIVYCl/r/cWV0H2Q8IvrQyZIMwK1uzRQuxOET3IPDty+TdXzaM8oUWyryRvf0xu2vbvl9q82bKeKbR3Utz33028JZmNDCGcGaje0hwdo8188tfNUx32zgEfUaGMu7nVoo26uC+16D218xUMb51fcv7BmO3Omv4b5YO1o3B7jqZ1+PkYOm/iPGt/z5OBRxLEa7C/ES4G/qtHIxcBbgQeG3HcO1U9ggG/Q7MqkrpMst28BXo6ZgpyJSWrXYbL1Y7CPrvSchv8r8lnT8VRZA/wfhl8t7ol5zE+z/OxC0ozQLan5fQuA5QHjGPSkBt97M7CThz6HvU5G8WrL7V/23E/PEuo99xcBlw25/ZGYkSdbEvG0dmElZ/tQWEO9das7A7/CrHOdg1m76eu18L2K+z8PHFbxPa4NGk/APQroyzcxjwuY9+3eCHtV374ukl0XpY+jOlk5okYfj68Zy+ctt/9zzZ8fxSpgR8zzdQ7Vj/8mzEjZFH4S67rmUm/jzzswaz9jca3JPhaTj2zBvBc8hHmsX0nftKrFgTB8U8RRmCTL5S8xJTLqOBGz29UlxIL9d2N2AQ1aRfVU1UHT32fje/1f1UjlKuBw6j9Gp7NtIrUT6UrH1B2F/Tgm0Y5lJc1GLJ9A/XVNsTYq/BDzxjWoyeuzruMxa91cDqbeRcN8zI6tnqXA4nZhZSH1xpQqewE/dtw/E/sH893Y15Eei1k758uhmAoDw+TwWNp+zycCn2j5s4Pq/D9jPN9yf05XaTL7F/P/ZHsfvQ7H7tVpg++bg/YZnHKdoDqZm6DZh8XlVO8w+miD9uqyfVjXmcdfjRl9jKHqDfFwzC+yScK7FFMbcB3m6j9VMreswffaRlRDaTr9XHfNWMyNJ3Mtt/t+Pe2GO5n7MeZ9oe4I8ErM83P99M8tHiU4qXQP7kX9tg+JC7Enc5/AbzIH9uez6+I6B4+suN/ntJ5tWcJPPfZxgMe2Ujg6dQAOtsGk+2r87ErgDMf9hw4mdGsqGmybyd6Ce6H/8S3bdbHtlrqj5s/HeBPZG/fj8jDaT71cgxmZe7Dlz49qT4ZPM7jWkfmY1gxlknpD+LY37296jKWK7ykw12thKe12Al+DmU4oXdVVdS5cu0cPxCz76HcQ9uRhC2ZUyrdTLLevCNBXG7ZpVdfCe4AvNOijqi3bxqFDGvRRxbbu8jqPfYT0Wcvtts9S145h32zLG+qWbXJ9ft7Zn9DNw52ZjzosmcvpBVVJa8/gG1wIrrUphwG/iRBDKLadZX+IPUGos24ztCc47vtOjZ+3lWD5zxax5GBf3AvrF0eKI1e29YB132di2Yx7lO6dfX+fgTuJD7Xh7HGW23NJ6H5mud21I3Q2wy8Ej7R8/zMdbbnK0PgsCWIrn/J9j32EYiutsw/wHst9lwSKZZjnWG6v+37h+h2s7k/oXNl31ZByXYsc9+U2TPqGwO3Pxb7L+DPk8ybWhu2Kp7dJxrZT2PaC8203x31rHffNofr0iPsst/teEBzrBJD/ctzXhRG2UdlGsVLU3KryfMd9/euNNzm+bx9PsQxjKyPRpLxKSP9gud2WiIJ9d+wyy+1/7GjrFsvtvkvG2GYZlnnux7fZDC+tswXzevyc5efaFI/3bW3N73OeetKfUNimTS4BflmzsyrDdr71zPbUhw9HYL9S8lVg2bUm6SWe+kjlQ5bbe/XmbC+sGKOiYJ9+6u2Ic10JV9UHs31o+i4qbBu697lTeHfsozGXYdbAjbvHWm63PcdTegD3hcUHcK+/fANpElXXRUVMbV5bw5advM3x/a4ROlspEd9rGW27bXMbdR70kOX2Ohe/qWp6NrEn8HrLfffC1oTuzY5GQhTNHObtHtuyrcn7UY2fvRr3lcgJjaMZbpRNGzmzJaoX9P3dtUkjxgvr2Zbbe4v67634+Re36HNti59xsW2+8DlN73pfcI22j5O5lttz/fCzTfWBqc1o22m+AlM5YJw1raN2nuX23gkF1zZo61LL7TE/L3KecnWtZe2/CLHt9raV+8rFhbgLZB8GWxO6t1u+KebV2H97bMtWqHZvzI6uG6f/vAmzq3czWw/AdZ1qcBl+yqu4FpE3eWJtotnhvgtbxNqULZkerJJu25xSp3bhqF5guf2zfX93jdL5GqUdha2ula+CtGCfTqwqQyRmV3SbA7hDHLnUb4p2G3SqatWNylWnre1h8KkNW7bTv16ryekTtrW5r2vQxqja/h7qbCYbla06x+ASAVv1ihAbMwe5NhKtxgwkLcOsA7wVM6LeewxdRddvY3rAoJfQ2aZV3lozUB98fhC5fjnzMfWO5k9/HUW9M23B36iEa31ekx2KTRcnP7rh9zdl2+QxrCSJ7fcd4izHQbbRrbV9f68apRu25jPmwdO2jQp1qqOP6v0R+hhXrvNSffm9ht8fY/d5iJMJYhoc2bSNdPYfc2jbeDL4wW/brBhiFNi1HrCt0CN7tmnIlWw/KOVa9hVqs0+P61SWAzEXNUdg1gE+C1NyrI79en+pSmSqiiX6VDepqsO2k2QUPosP2qZbbYteh2lT28jH4dk287BPPw07INlW7RzCv7Bsa/UGHx/X2ovPDrnNVm+xye91VFUnA9RlO1oIyt6w41OIkQdfv78qdY8wPIg4dSxzPgu2n23z4OB60mFrEVew7WNpK1UxuCTkZsv32XajjqKUMjz9LrLcPuzUJ9cMW+hp1z8L0OY2eckk7qOuYg5b+1zM7TM5vAz/laRtCWeTA7mbXmWHZiu8aysY7KoHGGu3a5WqK8vBK2lb2ZVcFnU38cLUARTAtYA9d4trfM/biLcW0PcIXag6orZ1b/2jRLaNUXXLMvVf8Ns2C/6W+jVVm/jTAG2GZCuKvYLm+YstMfTFZ7J8FUPykknqnx/nw0GO+9bGCqKmz2EesJiLv/9vg+/9k2BRNOdaGzBsdK5KrI04dbjq0g2uJbNNTX3NUyw9MQ6U/p0IfZQuZkHSEGyL9sEkRO9w3O+b76UWdWpGtmGbEu8fofus5XvqJmD9gyy2XcehPpeanHFdR5ONH23YNtG5Nv+4pl1zdwUmZxs6oj0Tf4cX1/GliH0N05sqmsRcXdvqz6Q6r25ug+/9Ema9w2bMVdwumOH8ZxO/BIxtkXzVdvHzCV/vb1DTxa9rMY+xbRr4OLZO1dreRHxXWLetqfE5KlFyUetYbEnvZ4AvAvdjzql22YJ5vW7Cf2mbKm9k2zVd/XIp41B1IsUE5vXZW0axDvOYNzmdoYkvWm7vbeqYx/DlCrblGCtxP9a2TTK+z2ru2d9y+2JM+bLelOUk5nlbVboo5JpQ2ylI78M9tXoJ9k0mBxJ/h/oqzOM4G3g49gv2Hal4vGf6jauSbVGgrWBjG67CjP07teZgf0IsJc0o0RG4r5r7fWz6a5Dt8N/b2wZVwba+A7aOzvUuGtaz7dmyrqvylzP8/zcq29SOq4r+k7BPKX+K6rWJru3mbdiOi7vPYx8xL/RKZfsgXoz/33kIrp2luYi5jtsH24iabR3tjdifR7ZjwOquf/QpRZ8uC7Cv830WcAMmv9mAST5nsXUK9n5Hu5finkkMYfD3b5sqvo6KI95m4t5JsQB/a9tc89PvdNzXlC1pHFzIvY6tWfGg00iT0NnKaTRhiztEodPdcB8XN8pB9W8lTEJnmyZzFXquKt/zMuJ+8Nh2K/vcKe4q8rw7fpPHrikhmQP7CUCui5sQbGWmSjRsTfpix/fbLrRfA/yj5T5Xe+PiBsd9rn0BVUb5zHJpUrv0KoYfLjAf875sHX2cBD7saNhVWLQp29Zi8HuAvG2nyrBDbV3z7LapCB981LKz2cNye4izRH3WDhwUqnaRbU1cVdHQpzjuu5y4JUtsb1hrPfbhSmKXeOxH0jnLcnuoDQU2tsXisRPLutZabrfVQnONbn3EcrttB6vPzYODYr6HjcLnANAwuwdo0/b5Mez36VoWVHn0l2sniOvsvyZcffg+k3J3y+13D7nN9YbhfOBG5FpL+N4R27YVLfZ9PMx+uEtb+BBi8b/tHNeqx6dqQbNtBLRpdflR+CyP4nptvMJjP6V6VOoAPJhruf3bMYPAvrPyZ1GjqM+2LmxYYtp2Ab5tGtZWNcAHW/HoWwP22dQE8DeB+/jbAG2+yHL7sLWerlq0rgLDtcp7jHqVtMFx3534LzpoG9mxXQnZKkdDuKrtb3Lc91rC1GHzfe5mjDf93I5j+V3HfT5K0ZTk0y1/bg5m3WHpbOs/fx41itHYisjaRppCsU255rp+rkk1Ap+7UbdQ7/jKtmxr9mLUIazLVqbEpxCfO3WK2fdzJe5LbHdM3LfqZLAvpO+5gO2PbqpjM+6kcSf8P1lso4GunauuEcRQO16rauQ8jHY7Ddv8/5s6FfvZgrdjdkNtwvwfqn6/s3CvW/D9+I/6+DxEs13Ep+D3ZIUZmMd2GN+P1etxr309hOYXfP2P/5OIV0jXtw8xfD3mNZRTwy/Ge0UdtjgOI88i1vOwb5Lqdwv23a39HqDeqQAnYC9G7MMyhm+UORn7gEhMTwa+a7nvx5hkdwvmonEd5rNlHbDr9O29z6LZmGVPrk15sT53ZmIfkWucl/QSuqofBrOT76UV39PzMqrrj70Q8+bnW5s3qR9gXqTDPIEwNfI+gDkM22Vfmo1gXoR9raLPJ6jtMT6fdmsP78Be/8hn3IdidpWN0s++NC8A3ebsTJtXYpKJQf8FPM1jPz1V7wufYfgC3kEvZ/gOwNAfUqGsZPiJLyX9f3JP6FKVj6qjTtHax1Nvg8xHsR8V1i/042H7Pz2bPKZdXQNEbR6b07GPdv0ZfjcStnmOvxczYzfMSQzJsfoTujpJGJiyGh9i+yvreZidOWfXaONi4Iwa39fUc7EXcXU9cHthMnybVKN0YK4kngdcb7n/RMxj6TrubBX+6kpdi30zSdvHyfXCWoS/QpC2keg1NNuq3qQCue/nzhKG72S+le2PDPLBlogNWorZmTw4qnwmcGHFz56HqYlWEtdzoDdq2auR5jKLrSViNgKHjxhXXa73vFwSuuXUWxa0DjPqshtmg90mzEjOX3uJbrg67wF1H8ejsRcj7nkP9k0svtj+T7dhTqbo1fibhXle1ylt9O/4qRjhmkXch+pKBMPsBvzact9Pgce2aNOm7UVLo1G6/oQOTE0xVxkKH0Ilc2BPSr9J9VFZrgduL6oPa2/DNYTs0zswx/iManfgV5b7LmG0F67t8b8L84L1YTXDp3eX0qwUwFzghzW/1/eHo21kaOgVmyf3ELa0xJGY6Z6ShDoWMVYy9QqGVzhYTrykEkwi9lCAdn2+bwyzAXdpnybTxTthEiaXGM+LnJ/Ttti2MNqa8xjLrQ7EfPa06WMT9v/fixgodD149VNnvn8UTyNcMgf2K7I6U7vnO+6zVQcf1R24S6f44hp99NVOqLp9tqnwNna33N60pMva0cIYybBkDsIult6LcIWGD6O8ZK4LbEWFY58Qckygdn8aqN2eqtMEmqz9qyrbFaN8S6iKBT52+f+d4z7X0Yx1uB7buSO23fN0y+22Wbd+rkLC2+2QHTacPYH/J9CdmIWJoQ8pt63Duq3Gz7rWfj2LMLVpwHyYhUzqNgMf9NDOcdiPSjvBQ/uupNlWiqUp2/OjzYLfOjWbQn+o9AtZnwrMVaLvEiw7kOei9yq2M3tH5XsnuoutLtaw9ZkhhSrk+k+B2u1xlZ5a7Lmvoed2etak8G0To74HTmCvh7uG0S9k3+q4z1U7twnbQFOdvKTqwmG//n/Y1iccQvUZenVswXyIPhmzkyc02zb8uiMwrg/FqxvG0sQyzO/C5+L56zBv2r6Od3OVmvCxCPwCx32unZY+tPkgvZfqkc+ulSzZA3vB0yYuw7xRhyywHdLzArUb+oK3n21NbZ0PGZ9GqervErrUhmvWp80xWbaLpfWEWe4zqGpJUltvH/HnXZ/Jtrp5TbjOT/ZVvuTxltvrXoS7Zg+3yRlcC04/gXnTPYnmH3hXYa6+ZxC3LIHtA/Y7NX/e9WEVemp0CvOiehjtE6R/w0ybT2CKXFYVw63Ldeajr6tH1/Dzszz1Mcwob5ZVI4c+y5W4+K7l6PIxtr4vNHXW9M/6rM2Vwi8DtRuymPkg23Om1DIyg6rOVx6V7eK77eYe23t+zPWMIYw6qm9L+K/E3wVhyOUqYI+zbj1D1+zhNuvrBjdFVNkbU7vlTzGjYbMx64m+gLm69FmpXoyXYR7ro9la/2w9ZkphinyLb8r4eDrwTMx6qHmY0ZHvY65+ryfOCIOIyFj7/2fvv67W/HRMAAAAAElFTkSuQmCC" alt="Moken" /></div>
            <div className="brand-name">Back Office Station</div>
          </div>
          <div className="lang-switch">
            {["fr", "en", "es"].map((l) => (
              <button key={l} className={lang === l ? "active" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="role-switch">
          <p>{t("demo_note")}</p>
          {["rep", "masterrep", "frontdesk", "directeur", "admin"].map((r) => (
            <button
              key={r}
              className={`role-btn ${role === r ? "active" : ""}`}
              onClick={() => { setRole(r); setView(r === "frontdesk" ? "file" : r === "admin" ? "catalogue" : r === "masterrep" ? "equipe" : "dashboard"); }}
            >
              <ArrowLeftRight size={13} />
              {t(`role_${r}`)}
            </button>
          ))}
        </div>

        {role === "frontdesk" && (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setNotifPanelOpen(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, padding: "8px 10px", color: "#D8DEE9", cursor: "pointer", fontSize: 12.5, position: "relative" }}>
              <Bell size={15} /> Notifications
              {notifications.filter((n) => !n.read).length > 0 && (
                <span className="nav-badge" style={{ marginLeft: "auto" }}>{notifications.filter((n) => !n.read).length}</span>
              )}
            </button>
          </div>
        )}

        <div className={`nav ${nav.length > 5 ? "nav-dense" : ""}`}>
          {nav.map((n) => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => setView(n.id)} title={n.label}>
              <n.icon size={16} />
              <span className="nav-label">{n.label}</span>
              {!!n.badge && <span className="nav-badge">{n.badge}</span>}
            </button>
          ))}
        </div>

        <div className="user-chip">
          {role === "rep" && "Camille Dubois · France"}
          {role === "masterrep" && `${currentMasterRep} · Master Rep`}
          {role === "frontdesk" && "Service administration des ventes"}
          {role === "directeur" && "Direction commerciale"}
          {role === "admin" && "Administration technique"}
        </div>
      </div>

      <div className="main">
        {/* ---------------- REP: DASHBOARD ---------------- */}
        {role === "rep" && view === "dashboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 className="page-title">{t("hello")}</h1>
                <p className="page-sub">{t("sub_dashboard")}</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select value={dashPeriod} onChange={(e) => setDashPeriod(e.target.value)}
                  style={{ padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12.5 }}>
                  <option value="semaine">{t("period")} : Semaine</option>
                  <option value="mois">{t("period")} : Mois</option>
                  <option value="annee">{t("period")} : Année</option>
                </select>
                <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  onClick={() => setView("crm")}>
                  <Plus size={15} /> {t("btn_new_order")}
                </button>
              </div>
            </div>
            {(() => {
              const scale = { semaine: 0.22, mois: 1, annee: 11.4 }[dashPeriod];
              const ca = Math.round(84200 * scale);
              const objectif = Math.round(100000 * scale);
              const overdueCount = tasks.filter((tk) => !tk.done && isOverdue(tk.due)).length;
              const myClients = accounts.filter((a) => a.type === "client" && a.ownerRep === "Camille Dubois");
              return (
                <div className="cards-row">
                  <div className="stat-card">
                    <div className="stat-label">CA réalisé / objectif ({dashPeriod})</div>
                    <div className="stat-value">{money(ca)}</div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, Math.round((ca / objectif) * 100))}%` }} /></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Comptes clients</div>
                    <div className="stat-value">{myClients.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Relances en retard</div>
                    <div className="stat-value" style={{ color: overdueCount > 0 ? "var(--danger)" : "inherit" }}>{overdueCount}</div>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const rangeN = getPeriodRange(dashPeriod, 0);
              const rangeN1 = getPeriodRange(dashPeriod, 1);
              const inRange = (d, r) => d && d >= r.from && d <= r.to;
              const myClients = accounts.filter((a) => a.type === "client" && a.ownerRep === "Camille Dubois");
              const wonN = myClients.filter((a) => inRange(a.wonDate, rangeN)).length;
              const wonN1 = myClients.filter((a) => inRange(a.wonDate, rangeN1)).length;
              const lostN = myClients.filter((a) => inRange(a.lostDate, rangeN)).length;
              const lostN1 = myClients.filter((a) => inRange(a.lostDate, rangeN1)).length;
              const orderedClientNames = new Set(
                queue.filter((o) => o.rep === "Camille Dubois" && inRange(o.createdAt, rangeN)).map((o) => o.account)
              );
              const activeWithOrder = myClients.filter((a) => orderedClientNames.has(a.name)).length;
              const activeWithoutOrder = myClients.length - activeWithOrder;
              const deltaBadge = (n, n1) => {
                const d = n - n1;
                return <span style={{ fontSize: 11.5, color: d > 0 ? "var(--teal)" : d < 0 ? "var(--danger)" : "var(--ink-soft)" }}>{d > 0 ? "+" : ""}{d} vs N-1 ({n1})</span>;
              };
              return (
                <div className="panel">
                  <h3>Portefeuille clients ({dashPeriod})</h3>
                  <div className="task-row">
                    <span>Comptes gagnés</span>
                    <span>{wonN} — {deltaBadge(wonN, wonN1)}</span>
                  </div>
                  <div className="task-row">
                    <span>Comptes perdus</span>
                    <span>{lostN} — {deltaBadge(lostN, lostN1)}</span>
                  </div>
                  <div className="task-row">
                    <span>Clients actifs ayant commandé sur la période</span>
                    <span style={{ color: "var(--teal)", fontWeight: 700 }}>{activeWithOrder}</span>
                  </div>
                  <div className="task-row">
                    <span>Clients actifs n'ayant pas commandé sur la période</span>
                    <span style={{ color: activeWithoutOrder > 0 ? "var(--danger)" : "inherit", fontWeight: 700 }}>{activeWithoutOrder}</span>
                  </div>
                </div>
              );
            })()}

            <div className="panel">
              <h3>Tâches du jour</h3>
              {tasks.filter((tk) => !tk.done).map((tk) => (
                <div className="task-row" key={tk.id}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={tk.done} onChange={() => toggleTaskDone(tk.id)} />
                    <span style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => { const acc = accounts.find((a) => a.id === tk.accountId); if (acc) openFiche(acc); }}>
                      {tk.accountName}
                    </span> — {tk.label}
                  </span>
                  <span style={{ color: isOverdue(tk.due) ? "var(--danger)" : "inherit" }}>{isOverdue(tk.due) ? "En retard" : tk.due}</span>
                </div>
              ))}
              {tasks.filter((tk) => !tk.done).length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucune tâche en attente.</p>}
            </div>

            <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 7 }}>Carte & tournées</h3>
            <RouteView accounts={accounts} routeStops={routeStops} toggleRouteStop={toggleRouteStop}
              routeComputed={routeComputed} setRouteComputed={setRouteComputed} openFiche={openFiche} t={t} embedded />
          </>
        )}

        {/* ---------------- CRM (liste) — rep : son portefeuille / frontdesk & directeur : vue globale ---------------- */}
        {view === "crm" && (() => {
          const teamRepNames = repsList.filter((r) => r.masterRep === currentMasterRep).map((r) => r.name);
          const visibleAccounts = role === "masterrep" ? accounts.filter((a) => teamRepNames.includes(a.ownerRep) || a.masterRep === currentMasterRep) : accounts;
          return (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 className="page-title">{t("title_crm")}</h1>
                <p className="page-sub">{role === "rep" ? t("sub_crm") : role === "masterrep" ? "Clients de tes représentants — tu peux ouvrir une fiche et créer une commande." : "Vue globale — tous représentants confondus."}</p>
              </div>
              {(role === "rep" || role === "frontdesk") && (
                <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  onClick={() => setAccountForm({ ...emptyAccountForm })}>
                  <Plus size={15} /> {t("btn_new_account")}
                </button>
              )}
            </div>
            <div className="search-bar"><Search size={15} color="#8892A0" /><input placeholder="Rechercher un compte..." /></div>
            {visibleAccounts.length === 0 && role === "masterrep" && <p style={{ color: "var(--ink-soft)" }}>Aucun client — tes représentants n'ont pas encore de comptes, ou aucun représentant ne t'est affecté.</p>}
            {visibleAccounts.map((a) => (
              <div className="account-row" key={a.id} onClick={() => openFiche(a)}>
                <div>
                  <div className="account-name">
                    {a.name}
                    {role === "frontdesk" && a.newForFrontdesk && <span className="offert-badge" style={{ marginLeft: 6 }}>Nouveau</span>}
                    {role === "frontdesk" && isFicheIncomplete(a) && <span className="offert-badge" style={{ marginLeft: 6, background: "#FBE2DE", color: "var(--danger)" }}>Fiche incomplète</span>}
                  </div>
                  <div className="account-meta">
                    <MapPin size={11} /> {a.country} · {a.lastContact}
                    {role === "masterrep" && <span className="typology-badge">{a.ownerRep}</span>}
                    <span className="typology-badge">{typologyLabel(a.typology, lang)}</span>
                  </div>
                </div>
                <span className="stage-badge">{a.stage}</span>
              </div>
            ))}
          </>
          );
        })()}

        {/* ---------------- FICHE COMPTE — accessible rep / frontdesk / directeur, contenu adapté au rôle ---------------- */}
        {view === "fiche" && selectedAccount && (
          <>
            <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => setView("crm")}>
              <ArrowLeft size={14} /> {t("btn_back")}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 className="page-title">{selectedAccount.name}</h1>
                <p className="page-sub">
                  {selectedAccount.type === "client" ? "Client" : "Prospect"} · {selectedAccount.country} ·{" "}
                  <span className="stage-badge">{selectedAccount.stage}</span>{" "}
                  <span className="typology-badge">{typologyLabel(selectedAccount.typology, lang)}</span>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn outline" onClick={() => setEditForm({
                  name: selectedAccount.name, type: selectedAccount.type, country: selectedAccount.country, typology: selectedAccount.typology,
                  billing: { ...selectedAccount.billing }, delivery: { ...selectedAccount.delivery },
                  contact: selectedAccount.contact, phoneCode: selectedAccount.phoneCode, phone: selectedAccount.phone,
                  mobileCode: selectedAccount.mobileCode, mobile: selectedAccount.mobile, email: selectedAccount.email,
                  iban: selectedAccount.iban || "", bic: selectedAccount.bic || "", sepaMandate: selectedAccount.sepaMandate || "Non reçu",
                  ownerRep: selectedAccount.ownerRep || "", masterRep: selectedAccount.masterRep || "",
                })}>Modifier la fiche</button>
                {(role === "rep" || role === "masterrep") && (
                  <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                    onClick={() => setView("prise-commande")}>
                    <ShoppingCart size={15} /> {t("btn_create_order")}
                  </button>
                )}
              </div>
            </div>

            <div className="panel">
              <h3><Building2 size={14} />Fiche société</h3>
              <div className="task-row"><span>{t("label_billing_addr")}</span><span>{selectedAccount.billing.street}, {selectedAccount.billing.postalCode} {selectedAccount.billing.city}, {selectedAccount.country}</span></div>
              <div className="task-row"><span>{t("label_delivery_addr")}</span><span>{selectedAccount.delivery.street}, {selectedAccount.delivery.postalCode} {selectedAccount.delivery.city}, {selectedAccount.country}</span></div>
              <div className="task-row"><span>{t("label_contact")}</span><span>{selectedAccount.contact}</span></div>
              <div className="task-row"><span><Phone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{t("label_phone")}</span><span>{selectedAccount.phoneCode} {selectedAccount.phone}</span></div>
              <div className="task-row"><span><Phone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{t("label_mobile")}</span><span>{selectedAccount.mobile ? `${selectedAccount.mobileCode} ${selectedAccount.mobile}` : "—"}</span></div>
              <div className="task-row"><span><Mail size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{t("label_email")}</span><span>{selectedAccount.email}</span></div>
              <div className="task-row"><span>{taxIdLabel(selectedAccount.country)}</span><span>{selectedAccount.taxId}</span></div>
              <div className="task-row"><span>{t("label_vat")}</span><span>{selectedAccount.vat}</span></div>
              {role === "rep" && (
                <div className="task-row">
                  <span>Étape du pipeline</span>
                  <select value={selectedAccount.stage} onChange={(e) => changeStage(e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12 }}>
                    {PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {role === "directeur" && (
                <>
                  <div className="task-row">
                    <span>Représentant affecté</span>
                    <select value={selectedAccount.ownerRep || ""} onChange={(e) => updateAccount(selectedAccount.id, () => ({ ownerRep: e.target.value }))}
                      style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12 }}>
                      <option value="">Aucun</option>
                      {repsList.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="task-row">
                    <span>Master Rep affecté</span>
                    <select value={selectedAccount.masterRep || ""} onChange={(e) => updateAccount(selectedAccount.id, () => ({ masterRep: e.target.value || null }))}
                      style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12 }}>
                      <option value="">Aucun</option>
                      {masterRepsList.map((mr) => <option key={mr.id} value={mr.name}>{mr.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {role === "rep" && (
              <div className="panel">
                <h3><Plus size={14} />Ajouter une interaction</h3>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <select value={interactionForm.type} onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }}>
                    <option>Visite</option><option>Appel</option><option>Email</option><option>SAV</option><option>Autre</option>
                  </select>
                  <input placeholder="Date de relance (optionnel)" type="date"
                    value={interactionForm.followUp} onChange={(e) => setInteractionForm({ ...interactionForm, followUp: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }} />
                </div>
                <div style={{ position: "relative" }}>
                  <textarea placeholder="Résumé de l'échange, objections, prochaines étapes... (ou dicte via le micro)"
                    value={interactionForm.comment} onChange={(e) => setInteractionForm({ ...interactionForm, comment: e.target.value })}
                    style={{ width: "100%", minHeight: 64, padding: 10, paddingRight: 40, border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, marginBottom: 10, fontFamily: "inherit" }} />
                  <button type="button" onClick={startVoiceNote} title="Dictée vocale"
                    style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", border: "none",
                      background: listening ? "var(--danger)" : "var(--teal-soft)", color: listening ? "white" : "var(--teal)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mic size={13} />
                  </button>
                </div>
                {listening && <p style={{ fontSize: 11.5, color: "var(--teal)", marginTop: -6, marginBottom: 8 }}>🎙️ Écoute en cours — parle normalement...</p>}
                <button className="btn primary" onClick={logInteraction}>Enregistrer l'interaction</button>
                {interactionForm.followUp && <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>Une tâche de relance sera créée automatiquement pour cette date.</p>}
              </div>
            )}

            {role === "rep" && (
              <div className="panel">
                <h3><CalendarDays size={14} />Planifier (agenda)</h3>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <select value={planForm.type} onChange={(e) => setPlanForm({ ...planForm, type: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }}>
                    <option>Rendez-vous</option><option>Appel</option><option>Déplacement</option>
                  </select>
                  <input type="date" value={planForm.date} onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }} />
                  <input type="time" value={planForm.time} onChange={(e) => setPlanForm({ ...planForm, time: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }} />
                </div>
                <input placeholder="Note (objet du rendez-vous...)" value={planForm.note} onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, marginBottom: 10 }} />
                <button className="btn primary" onClick={addAgendaEvent} disabled={!planForm.date}>Ajouter à l'agenda</button>
              </div>
            )}

            {role === "rep" && (
              <div className="panel">
                <h3><ClipboardCheck size={14} />SAV</h3>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <input placeholder="Motif (produit, réf...)" value={savForm.motif} onChange={(e) => setSavForm({ ...savForm, motif: e.target.value })}
                    style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13 }} />
                </div>
                <textarea placeholder="Description du problème..." value={savForm.description} onChange={(e) => setSavForm({ ...savForm, description: e.target.value })}
                  style={{ width: "100%", minHeight: 50, padding: 10, border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, marginBottom: 10, fontFamily: "inherit" }} />
                <button className="btn outline" onClick={createSavTicket}>Créer un ticket SAV</button>
              </div>
            )}

            {role !== "rep" && (
              <div className="panel">
                <h3><FileDown size={14} />Documents</h3>
                <div className="task-row"><span>Fiche_client_{selectedAccount.name.replace(/\s+/g, "_")}.pdf</span><span>Généré automatiquement à la création</span></div>
                <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>Aperçu PDF non disponible dans ce prototype — génération réelle prévue côté serveur.</p>
              </div>
            )}

            <div className="panel">
              <h3><Lock size={13} />{t("label_bank")}</h3>
              <div className="task-row"><span>IBAN</span><span style={{ fontFamily: "monospace" }}>{selectedAccount.iban || "Non renseigné"}</span></div>
              <div className="task-row"><span>BIC / SWIFT</span><span style={{ fontFamily: "monospace" }}>{selectedAccount.bic || "Non renseigné"}</span></div>
              <div className="task-row"><span>Mandat SEPA</span><span>{selectedAccount.sepaMandate}</span></div>
              <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>Modifiable via "Modifier la fiche" en haut de page. Utilisé uniquement pour le prélèvement SEPA et l'administration des ventes.</p>
            </div>

            <div className="panel">
              <h3><FileDown size={14} />Pièces jointes</h3>
              {(selectedAccount.attachments || []).length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucune pièce jointe pour ce client.</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                {(selectedAccount.attachments || []).map((att) => (
                  <a href={att.dataUrl} target="_blank" rel="noreferrer" key={att.id} style={{ display: "block", textAlign: "center", width: 84 }}>
                    {att.type?.startsWith("image") ? (
                      <img src={att.dataUrl} alt={att.name} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
                    ) : (
                      <div style={{ width: 84, height: 84, borderRadius: 6, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F1EA" }}>
                        <FileDown size={20} color="var(--ink-soft)" />
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4, wordBreak: "break-word" }}>{att.name}</div>
                  </a>
                ))}
              </div>
              <label className="btn outline" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Plus size={14} /> Ajouter une pièce jointe / prendre une photo
                <input type="file" accept="image/*,.pdf" capture="environment" style={{ display: "none" }} onChange={handleAttachmentUpload} />
              </label>
            </div>

            <div className="panel">
              <h3><ShoppingCart size={14} />Toutes les commandes</h3>
              {queue.filter((o) => o.account === selectedAccount.name).map((o) => (
                <div className="task-row" key={o.id} style={{ cursor: "pointer" }} onClick={() => setOrderDetail(o)}>
                  <span>
                    {o.createdAt} — {o.items?.length || 0} article(s) — {o.rep}
                    {o.isPreOrder && <span className="offert-badge" style={{ marginLeft: 6 }}>Précommande</span>}
                  </span>
                  <span>{money(o.total)} · <span className={`queue-status ${o.status}`} style={{ marginLeft: 4 }}>{o.status === "nouvelle" ? "À contrôler" : "Importée"}</span></span>
                </div>
              ))}
              {queue.filter((o) => o.account === selectedAccount.name).length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucune commande pour ce client.</p>}
            </div>

            <div className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}><History size={14} />Historique des interactions</h3>
                <select value={historyPeriod} onChange={(e) => setHistoryPeriod(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12 }}>
                  <option value="all">Toute la période</option>
                  <option value="7j">7 derniers jours</option>
                  <option value="30j">30 derniers jours</option>
                  <option value="trimestre">Trimestre</option>
                  <option value="annee">Année</option>
                </select>
              </div>
              {filteredHistory.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucun évènement sur cette période.</p>}
              {filteredHistory.map((h, idx) => (
                <div className="task-row" key={idx}><span>{h.label} — {h.detail}</span><span>{h.date}</span></div>
              ))}
            </div>
          </>
        )}

        {/* ---------------- REP: CARTE & TOURNÉES ---------------- */}
        {/* ---------------- REP: COMMANDES (historique complet, ses commandes uniquement) ---------------- */}
        {/* ---------------- DIRECTEUR : CARTE (visualisation, pas de tournée) ---------------- */}
        {role === "directeur" && view === "carte" && (
          <RouteView accounts={accounts} routeStops={[]} toggleRouteStop={() => {}}
            routeComputed={false} setRouteComputed={() => {}} openFiche={openFiche} t={t}
            showRepFilters repsList={repsList} masterRepsList={masterRepsList} />
        )}

        {role === "rep" && view === "commandes" && (() => {
          const q = (repOrdersSearch || "").trim().toLowerCase();
          const myOrders = [...queue]
            .filter((o) => o.rep === "Camille Dubois")
            .filter((o) => (!repOrdersFrom || o.createdAt >= repOrdersFrom) && (!repOrdersTo || o.createdAt <= repOrdersTo))
            .filter((o) => repOrdersClient === "all" || o.account === repOrdersClient)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
          return (
            <>
              <h1 className="page-title">Commandes</h1>
              <p className="page-sub">Historique complet de tes commandes — les plus récentes en premier.</p>
              <div className="filter-row">
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>Du</label>
                  <input type="date" value={repOrdersFrom} onChange={(e) => setRepOrdersFrom(e.target.value)} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>Au</label>
                  <input type="date" value={repOrdersTo} onChange={(e) => setRepOrdersTo(e.target.value)} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5 }} />
                </div>
                <select value={repOrdersClient} onChange={(e) => setRepOrdersClient(e.target.value)}>
                  <option value="all">Client : {t("all")}</option>
                  {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              {myOrders.map((o) => (
                <div className="queue-card" key={o.id}>
                  <div style={{ cursor: "pointer" }} onClick={() => setOrderDetail(o)}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                      {o.account} {o.isPreOrder && <span className="offert-badge" style={{ marginLeft: 6 }}>Précommande</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{money(o.total)} · {o.createdAt}</div>
                  </div>
                  <span className={`queue-status ${o.status}`}>{o.status === "nouvelle" ? "À contrôler" : "Importée"}</span>
                </div>
              ))}
              {myOrders.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucune commande pour ces filtres.</p>}
            </>
          );
        })()}

        {/* ---------------- REP: CATALOGUE (référence — pas de commande ici) ---------------- */}
        {role === "rep" && view === "catalogue" && (
          <>
            <h1 className="page-title">Catalogue</h1>
            <p className="page-sub">Consultation du catalogue en cours — disponibilités, stock et arrivages. Pour commander, va sur la fiche d'un client.</p>

            <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Frais de port</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Ajoutés par défaut à chaque commande, réglable à l'envoi{shippingThreshold !== null ? ` — offerts dès ${money(shippingThreshold)} d'achat` : ""}.</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{money(shippingAmount)}</div>
            </div>

            {catalogNames.length > 1 && (
              <>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Catalogues</p>
                <CatalogSelector catalogNames={catalogNames} active={activeCatalogs} onToggle={toggleCatalogSelection} />
              </>
            )}

            <div className="search-bar"><Search size={15} color="#8892A0" />
              <input placeholder="Rechercher réf, modèle, couleur..." value={catSearch} onChange={(e) => setCatSearch(e.target.value)} />
            </div>

            <div className="cat-tabs">
              <button className={`cat-tab ${catFilterCategory === "all" ? "active" : ""}`} onClick={() => setCatFilterCategory("all")}>Toutes</button>
              {CATEGORIES.filter((c) => catalog.some((p) => p.category === c && activeCatalogs.includes(p.catalogName || "Sans catalogue"))).map((c) => (
                <button key={c} className={`cat-tab ${catFilterCategory === c ? "active" : ""}`} onClick={() => setCatFilterCategory(c)}>
                  {c === "Display" && <Gift size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}{c}
                </button>
              ))}
            </div>

            {(() => {
              const q = catSearch.trim().toLowerCase();
              const results = catalog.filter((p) =>
                activeCatalogs.includes(p.catalogName || "Sans catalogue") &&
                p.productStatus !== "Discontinué" &&
                (catFilterCategory === "all" || p.category === catFilterCategory) &&
                (!q || [p.ref, p.label, p.model, p.color].join(" ").toLowerCase().includes(q))
              );
              return (
                <div className="product-grid">
                  {results.map((p) => (
                    <div className="product-card" key={p.id}>
                      <img src={p.photoUrl || photoFor(p.label)} alt={p.label} onError={(e) => { e.currentTarget.src = photoFor(p.label); }} />
                      <div className="product-body">
                        <div className="product-ref">{p.ref} {p.productStatus === "Nouveau" && <span className="offert-badge" style={{ marginLeft: 4 }}>Nouveau</span>}</div>
                        <div className="product-name">{p.label}</div>
                        <div className="product-price">{(p.priceFR || p.rrp) ? money(p.priceFR || p.rrp) : <span style={{ color: "var(--ink-soft)" }}>Prix à définir</span>}</div>
                        <div className="product-stock" style={{ color: p.stockStatus === "En stock" ? "var(--teal)" : "var(--danger)" }}>
                          {p.stockStatus === "En stock" ? "En stock" : p.stockStatus === "Réassort prévu"
                            ? `Réassort ${p.restockDate ? "prévu le " + p.restockDate : "— date non connue"}`
                            : `Rupture — ${p.restockDate ? "retour prévu le " + p.restockDate : "date de retour non connue"}`}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>{p.catalogName}</div>
                      </div>
                    </div>
                  ))}
                  {results.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucune référence pour ces filtres.</p>}
                </div>
              );
            })()}
          </>
        )}

        {/* ---------------- REP: PRISE DE COMMANDE (catalogue + panier, rattaché à un client) ---------------- */}
        {(role === "rep" || role === "masterrep") && view === "prise-commande" && !selectedAccount && (
          <>
            <h1 className="page-title">{t("title_catalogue")}</h1>
            <p className="page-sub">Une commande est toujours rattachée à un client. Choisis-en un pour commencer.</p>
            <button className="btn primary" onClick={() => setView("crm")}>{t("btn_choose_client")}</button>
          </>
        )}
        {(role === "rep" || role === "masterrep") && view === "prise-commande" && selectedAccount && (
          <CatalogueView
            selectedAccount={selectedAccount}
            catalog={catalog}
            catalogNames={catalogNames}
            activeCatalogs={activeCatalogs}
            toggleCatalogSelection={toggleCatalogSelection}
            cart={cart}
            changeQty={changeQty}
            goToCart={() => setView("panier")}
            changeClient={() => setView("crm")}
            backToFiche={() => setView("fiche")}
            t={t}
          />
        )}

        {/* ---------------- REP: PANIER ---------------- */}
        {(role === "rep" || role === "masterrep") && view === "panier" && !selectedAccount && (
          <>
            <h1 className="page-title">{t("nav_panier")}</h1>
            <p className="page-sub">Aucun client sélectionné pour l'instant.</p>
            <button className="btn primary" onClick={() => setView("crm")}>{t("btn_choose_client")}</button>
          </>
        )}
        {(role === "rep" || role === "masterrep") && view === "panier" && selectedAccount && (
          <>
            <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => setView("prise-commande")}>
              <ArrowLeft size={14} /> Retour au catalogue
            </button>
            <h1 className="page-title">Récapitulatif — {selectedAccount.name}</h1>
            <p className="page-sub">Vérifie les remises et les articles offerts avant d'envoyer au front desk.</p>
            {Object.keys(byCategory).length === 0 && <p style={{ color: "var(--ink-soft)" }}>Le panier est vide. Ajoute des produits depuis le catalogue.</p>}
            {Object.entries(byCategory).map(([cat, g]) => (
              <div className="cat-block panel" key={cat}>
                <div className="cat-head">
                  <h4 style={{ display: "block" }}>{cat}</h4>
                  <div className="toggle" onClick={() => setDiscountApplied((d) => ({ ...d, [cat]: !d[cat] }))}>
                    Remise {Math.round(discountRateFor(cat) * 100)} %
                    <div className={`switch ${discountApplied[cat] ? "on" : ""}`} />
                  </div>
                </div>
                {g.items.map((i) => (
                  <div className="line-item" key={i.id}>
                    <span>
                      {i.qty} × {i.label} {i.offert && <span className="offert-badge">{t("offert")}</span>}
                      {!isPreOrder && i.stockStatus === "Réassort prévu" && (
                        <span className="offert-badge" style={{ background: "var(--gold-soft)", color: "#8A6A0E", marginLeft: 4 }}>
                          Reliquat — livraison tardive{i.restockDate ? ` (${i.restockDate})` : ""}
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="toggle" onClick={() => toggleOffert(i.id)}>
                        {t("offert")} <div className={`switch gold ${i.offert ? "on" : ""}`} />
                      </div>
                      <span>{i.offert ? "0 €" : money(i.price * i.qty)}</span>
                    </div>
                  </div>
                ))}
                <div className="cat-subtotal">
                  <span>Sous-total {discountApplied[cat] ? "(remise appliquée)" : "(brut)"} — {g.items.reduce((s, i) => s + i.qty, 0)} unité(s)</span>
                  <span>{money(discountApplied[cat] ? g.subtotal * (1 - discountRateFor(cat)) : g.subtotal)}</span>
                </div>
              </div>
            ))}

            {cartItems.length > 0 && (
              <div className="cat-block panel">
                <div className="cat-head">
                  <h4 style={{ display: "block" }}>Frais de port</h4>
                  <div className="toggle" onClick={() => setShippingOffert((v) => !v)}>
                    Offrir <div className={`switch gold ${shippingOffert ? "on" : ""}`} />
                  </div>
                </div>
                <div className="line-item">
                  <span>Frais de port {shippingOffert && <span className="offert-badge">{t("offert")}</span>}</span>
                  <span>{shippingOffert ? "0 €" : money(shippingAmount)}</span>
                </div>
                {shippingThreshold !== null && !shippingOffert && (
                  <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                    {shippingAutoEligible
                      ? `Cette commande atteint le seuil de ${money(shippingThreshold)} — les frais de port peuvent être offerts.`
                      : `Offerts à partir de ${money(shippingThreshold)} d'achat (encore ${money(Math.max(0, shippingThreshold - grandTotal))} pour en bénéficier).`}
                  </p>
                )}
              </div>
            )}

            {cartItems.length > 0 && (() => {
              const totalQty = cartItems.reduce((s, i) => s + i.qty, 0);
              const totalAmount = cartItems.reduce((s, i) => s + (i.offert ? 0 : i.price * i.qty), 0);
              const backorderItems = !isPreOrder ? cartItems.filter((i) => i.stockStatus === "Réassort prévu") : [];
              const backorderQty = backorderItems.reduce((s, i) => s + i.qty, 0);
              const backorderAmount = backorderItems.reduce((s, i) => s + (i.offert ? 0 : i.price * i.qty), 0);
              return (
                <div className="panel">
                  <h3>Totaux</h3>
                  <div className="task-row"><span>Quantité totale</span><span>{totalQty} pièce(s)</span></div>
                  <div className="task-row"><span>Montant total (marchandise)</span><span>{money(totalAmount)}</span></div>
                  <div className="task-row"><span>Frais de port</span><span>{shippingOffert ? <span className="offert-badge">Offert</span> : money(shippingAmount)}</span></div>
                  <div className="task-row" style={{ fontWeight: 800, borderTop: "1px dashed var(--line)", paddingTop: 8, marginTop: 4 }}>
                    <span>Total commande</span><span>{money(orderTotalWithShipping)}</span>
                  </div>
                  {backorderItems.length > 0 && (
                    <>
                      <div className="task-row" style={{ color: "#8A6A0E" }}>
                        <span>Dont reliquat (livraison tardive)</span>
                        <span>{backorderQty} pièce(s) — {money(backorderAmount)}</span>
                      </div>
                      {backorderItems.map((i) => (
                        <div className="task-row" key={i.id} style={{ fontSize: 12, paddingLeft: 12 }}>
                          <span>{i.qty} × {i.label}</span>
                          <span style={{ color: "#8A6A0E" }}>{i.restockDate ? `Expédition dès le ${i.restockDate}` : "Date d'expédition non encore connue"}</span>
                        </div>
                      ))}
                      <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>Ces articles sont en réassort prévu ; ils seront expédiés séparément dès leur disponibilité.</p>
                    </>
                  )}
                </div>
              );
            })()}

            {cartItems.length > 0 && (
              <div className="panel">
                <h3>Informations complémentaires</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12, padding: "8px 10px", background: isPreOrder ? "var(--gold-soft)" : "transparent", borderRadius: 5 }}>
                  <input type="checkbox" checked={isPreOrder} onChange={(e) => setIsPreOrder(e.target.checked)} />
                  <span style={{ fontWeight: 600 }}>Précommande</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>— comptabilisée séparément du chiffre d'affaires ferme</span>
                </label>
                <div className="cc-field">
                  <label>Date de livraison souhaitée</label>
                  <input type="date" value={desiredDeliveryDate} onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="cc-field">
                  <label>Note pour le front desk (gratuité, vitrophanie, instructions particulières...)</label>
                  <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="ex : merci d'ajouter une vitrophanie offerte pour ce point de vente"
                    style={{ width: "100%", minHeight: 64, padding: 10, border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, fontFamily: "inherit" }} />
                </div>
              </div>
            )}

            {cartItems.length > 0 && (
              <>
                <div className="grand-total"><span>Total</span><span>{money(grandTotal)}</span></div>
                <button className="btn primary" onClick={sendToFrontdesk}>{t("btn_send_frontdesk")}</button>
              </>
            )}
          </>
        )}

        {/* ---------------- FRONT DESK ---------------- */}
        {((role === "frontdesk" && view === "file") || (role === "directeur" && view === "frontdesk-view")) && (() => {
          const inPeriod = (dateStr) => {
            if (fdPeriod === "all" || !dateStr) return true;
            const days = { "7j": 7, "30j": 30, mois: 30, trimestre: 90, annee: 365 }[fdPeriod];
            return (Date.now() - new Date(dateStr).getTime()) / 86400000 <= days;
          };
          const q = fdSearch.trim().toLowerCase();
          const base = queue.filter((o) => fdStatusFilter === "all" || o.status === fdStatusFilter);
          const filteredQueue = base.filter((o) => inPeriod(o.createdAt) && (!q || o.account.toLowerCase().includes(q)));
          return (
            <>
              <h1 className="page-title">Commandes</h1>
              <p className="page-sub">Toutes les commandes reçues des représentants — à contrôler ou déjà transmises à Dolibarr.</p>
              <div className="search-bar"><Search size={15} color="#8892A0" /><input placeholder="Rechercher un client..." value={fdSearch} onChange={(e) => setFdSearch(e.target.value)} /></div>
              <div className="filter-row">
                <select value={fdStatusFilter} onChange={(e) => setFdStatusFilter(e.target.value)}>
                  <option value="all">Statut : Toutes</option>
                  <option value="nouvelle">À contrôler</option>
                  <option value="importée">Importées</option>
                </select>
                <select value={fdPeriod} onChange={(e) => setFdPeriod(e.target.value)}>
                  <option value="all">{t("period")} : {t("all")}</option>
                  <option value="7j">7 derniers jours</option>
                  <option value="30j">30 derniers jours</option>
                  <option value="trimestre">Trimestre</option>
                  <option value="annee">Année</option>
                </select>
              </div>
              {filteredQueue.map((o) => (
                <div className="queue-card" key={o.id}>
                  <div style={{ cursor: "pointer" }} onClick={() => {
                    const acc = accounts.find((a) => a.name === o.account);
                    if (acc) openFiche(acc);
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline" }}>
                      {o.account} {o.isPreOrder && <span className="offert-badge" style={{ marginLeft: 6 }}>Précommande</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Par {o.rep} · {money(o.total)} · {o.createdAt}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`queue-status ${o.status}`}>{o.status === "nouvelle" ? "À contrôler" : "Importée"}</span>
                    <button className="btn outline" style={{ padding: "8px 12px" }} onClick={() => setOrderDetail(o)}>Voir le détail</button>
                    {o.status === "nouvelle" && (
                      <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}
                        onClick={() => openExportCheck(o)}>
                        <FileDown size={14} /> Fichier Dolibarr (.xlsx)
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredQueue.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucune commande pour ces filtres.</p>}
            </>
          );
        })()}

        {/* ---------------- DIRECTEUR ---------------- */}
        {role === "directeur" && view === "dashboard" && (() => {
          const totalObjectifAll = repsList.reduce((sum, r) => sum + (r.objectif || 0), 0);
          const totalCommandesAll = queue.filter((o) => !o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
          const totalPreorderAmountAll = queue.filter((o) => o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
          const totalPreorderObjectifAll = objectives.filter((o) => o.metric === "Précommande").reduce((sum, o) => sum + o.target, 0);
          const pctCommandes = totalObjectifAll > 0 ? Math.round((totalCommandesAll / totalObjectifAll) * 100) : 0;
          const pctPreorder = totalPreorderObjectifAll > 0 ? Math.round((totalPreorderAmountAll / totalPreorderObjectifAll) * 100) : 0;
          return (
            <>
              <h1 className="page-title">{t("nav_dashboard")}</h1>
              <p className="page-sub">France, Espagne — tous représentants.</p>
              <div className="cards-row">
                <div className="stat-card">
                  <div className="stat-label">Commandes fermes cumulées / objectif</div>
                  <div className="stat-value">{money(totalCommandesAll)} / {money(totalObjectifAll)}</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, pctCommandes)}%` }} /></div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Précommandes cumulées / objectif</div>
                  <div className="stat-value" style={{ color: "var(--gold)" }}>{money(totalPreorderAmountAll)} / {money(totalPreorderObjectifAll)}</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, pctPreorder)}%`, background: "var(--gold)" }} /></div>
                </div>
                <div className="stat-card"><div className="stat-label">Commandes en attente frontdesk</div><div className="stat-value">{queue.filter(o=>o.status==="nouvelle").length}</div></div>
              </div>
              <div className="panel">
                <h3>Performance par représentant</h3>
                <table className="reps-table">
                  <thead><tr><th>Représentant</th><th>Territoire</th><th>CA</th><th>Objectif</th><th>Progression</th></tr></thead>
                  <tbody>
                    {masterRepsList.map((mr) => {
                      const team = repsList.filter((r) => r.masterRep === mr.name);
                      const teamNames = team.map((r) => r.name);
                      const mrCa = queue.filter((o) => teamNames.includes(o.rep) && !o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
                      const mrObjectif = team.reduce((sum, r) => sum + (r.objectif || 0), 0);
                      return (
                        <tr key={mr.id} style={{ background: "var(--teal-soft)" }}>
                          <td style={{ fontWeight: 700 }}>{mr.name} <span className="typology-badge" style={{ marginLeft: 6 }}>Master Rep</span></td>
                          <td>{mr.region}, {mr.country}</td>
                          <td>{money(mrCa)}</td>
                          <td>{money(mrObjectif)}</td>
                          <td style={{ width: 120 }}>
                            <div className="progress-track"><div className="progress-fill" style={{ width: `${mrObjectif > 0 ? Math.min(100, Math.round((mrCa / mrObjectif) * 100)) : 0}%` }} /></div>
                          </td>
                        </tr>
                      );
                    })}
                    {repsList.map((r) => {
                      const repCa = queue.filter((o) => o.rep === r.name && !o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
                      return (
                        <tr key={r.id}>
                          <td>{r.masterRep && <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>↳ </span>}{r.name}</td>
                          <td>{r.region}, {r.country}</td>
                          <td>{money(repCa)}</td>
                          <td>{money(r.objectif)}</td>
                          <td style={{ width: 120 }}>
                            <div className="progress-track"><div className="progress-fill" style={{ width: `${r.objectif > 0 ? Math.min(100, Math.round((repCa / r.objectif) * 100)) : 0}%` }} /></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
        {(role === "directeur" || role === "masterrep") && view === "rep-profile" && selectedRepProfile && (() => {
          const r = selectedRepProfile;
          const repObjectives = objectives.filter((o) => o.rep === r.name);
          const repTasks = tasks.filter((tk) => tk.rep === r.name);
          const repEvents = agendaEvents.filter((e) => e.rep === r.name).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          const overdueCount = repTasks.filter((tk) => !tk.done && isOverdue(tk.due)).length;
          const upcomingEvents = repEvents.filter((e) => e.date >= new Date().toISOString().slice(0, 10));
          return (
            <>
              <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => setView("equipe")}>
                <ArrowLeft size={14} /> Retour à l'équipe
              </button>
              <h1 className="page-title">{r.name}</h1>
              <p className="page-sub">{r.region}, {r.country}</p>

              <div className="cards-row">
                <div className="stat-card">
                  <div className="stat-label">CA réalisé / objectif global</div>
                  <div className="stat-value">{money(r.ca)} / {money(r.objectif)}</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, Math.round((r.ca / (r.objectif || 1)) * 100))}%` }} /></div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Tâches en retard</div>
                  <div className="stat-value" style={{ color: overdueCount > 0 ? "var(--danger)" : "inherit" }}>{overdueCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Rendez-vous à venir</div>
                  <div className="stat-value">{upcomingEvents.length}</div>
                </div>
              </div>

              <div className="panel">
                <h3>Objectifs par secteur</h3>
                {repObjectives.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucun objectif spécifique assigné.</p>}
                {repObjectives.map((o) => (
                  <div className="task-row" key={o.id}>
                    <span>
                      {o.metric === "Précommande" && <span className="typology-badge" style={{ background: "var(--gold-soft)", color: "#8A6A0E", marginRight: 4 }}>Précommande</span>}
                      <span className="typology-badge">{[...new Set(o.typologies.map((c) => sectorFor(c)))].join(" + ")}</span> — {o.typologies.map((c) => typologyLabel(c, lang)).join(", ")} — {o.categories.join(", ")}
                    </span>
                    <span>{money(o.target)} · {o.period}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <h3>Tâches</h3>
                {repTasks.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucune tâche suivie pour ce représentant.</p>}
                {repTasks.map((tk) => (
                  <div className="task-row" key={tk.id}>
                    <span style={{ textDecoration: tk.done ? "line-through" : "none", opacity: tk.done ? 0.6 : 1 }}>{tk.accountName} — {tk.label}</span>
                    <span style={{ color: !tk.done && isOverdue(tk.due) ? "var(--danger)" : "inherit" }}>{tk.done ? "Terminée" : (isOverdue(tk.due) ? "En retard" : tk.due)}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <h3>Prochains rendez-vous</h3>
                {upcomingEvents.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucun rendez-vous planifié.</p>}
                {upcomingEvents.map((ev) => (
                  <div className="task-row" key={ev.id}>
                    <span><strong>{ev.type}</strong> — {ev.accountName}{ev.note ? ` · ${ev.note}` : ""}</span>
                    <span>{ev.date}{ev.time ? ` à ${ev.time}` : ""}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {role === "masterrep" && view === "equipe" && (() => {
          const teamReps = repsList.filter((r) => r.masterRep === currentMasterRep);
          const teamNames = teamReps.map((r) => r.name);
          const totalObjectif = teamReps.reduce((sum, r) => sum + (r.objectif || 0), 0);
          const teamOrders = queue.filter((o) => teamNames.includes(o.rep));
          const totalCommandes = teamOrders.filter((o) => !o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
          const totalPreorders = teamOrders.filter((o) => o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
          const pct = totalObjectif > 0 ? Math.round((totalCommandes / totalObjectif) * 100) : 0;
          return (
            <>
              <h1 className="page-title">Mon équipe</h1>
              <p className="page-sub">Représentants qui te sont affectés par la direction commerciale — suivi des objectifs, tâches et rendez-vous.</p>

              {teamReps.length > 0 && (
                <div className="cards-row">
                  <div className="stat-card">
                    <div className="stat-label">Commandes fermes cumulées / objectif équipe</div>
                    <div className="stat-value">{money(totalCommandes)} / {money(totalObjectif)}</div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Précommandes en cours (hors CA ferme)</div>
                    <div className="stat-value" style={{ color: "var(--gold)" }}>{money(totalPreorders)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Représentants affectés</div>
                    <div className="stat-value">{teamReps.length}</div>
                  </div>
                </div>
              )}

              {teamReps.length === 0 && (
                <p style={{ color: "var(--ink-soft)" }}>Aucun représentant ne t'est encore affecté.</p>
              )}
              {teamReps.map((r) => {
                const repTotal = queue.filter((o) => o.rep === r.name && !o.isPreOrder).reduce((sum, o) => sum + o.total, 0);
                return (
                  <div className="account-row" key={r.id} onClick={() => { setSelectedRepProfile(r); setView("rep-profile"); }}>
                    <div>
                      <div className="account-name">{r.name}</div>
                      <div className="account-meta"><Globe size={11} /> {r.country} · {r.region}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{money(repTotal)} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>/ {money(r.objectif)}</span></div>
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>Les objectifs sont fixés par la direction commerciale — tu peux ici suivre leur avancement, pas les modifier.</p>
            </>
          );
        })()}
        {role === "directeur" && view === "equipe" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 className="page-title">{t("nav_equipe")}</h1>
                <p className="page-sub">Affectation des représentants par pays, région, et Master Rep.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  onClick={() => setNewMasterRepForm({ name: "", email: "", country: "France", region: "" })}>
                  <Plus size={15} /> Nouveau Master Rep
                </button>
                <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  onClick={() => setNewRepForm({ name: "", email: "", country: "France", region: "", objectif: "" })}>
                  <Plus size={15} /> Nouveau représentant
                </button>
              </div>
            </div>

            {masterRepsList.length > 0 && (
              <div className="panel">
                <h3>Master Reps</h3>
                {masterRepsList.map((mr) => (
                  <div className="task-row" key={mr.id}>
                    <span>{mr.name} — {mr.region}, {mr.country}</span>
                    <span style={{ color: "var(--ink-soft)" }}>{repsList.filter((r) => r.masterRep === mr.name).length} représentant(s) affecté(s)</span>
                  </div>
                ))}
              </div>
            )}

            {repsList.map((r) => (
              <div className="account-row" key={r.id}>
                <div style={{ cursor: "pointer" }} onClick={() => { setSelectedRepProfile(r); setView("rep-profile"); }}>
                  <div className="account-name">{r.name}</div>
                  <div className="account-meta"><Globe size={11} /> {r.country} · {r.region}</div>
                </div>
                <select value={r.masterRep || ""} onChange={(e) => {
                  const val = e.target.value || null;
                  setRepsList((rl) => rl.map((x) => (x.id === r.id ? { ...x, masterRep: val } : x)));
                }} onClick={(e) => e.stopPropagation()}
                  style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12 }}>
                  <option value="">Aucun Master Rep</option>
                  {masterRepsList.map((mr) => <option key={mr.id} value={mr.name}>{mr.name}</option>)}
                </select>
              </div>
            ))}

            <div className="panel" style={{ marginTop: 18 }}>
              <h3>Répartition par territoire</h3>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>Nombre de clients/prospects par pays, et représentant(s) couvrant ce territoire.</p>
              <table className="data-table">
                <thead><tr><th>Territoire</th><th>Clients & prospects</th><th>Représentant(s) affecté(s)</th></tr></thead>
                <tbody>
                  {[...new Set(accounts.map((a) => a.country))].map((country) => (
                    <tr key={country}>
                      <td>{country}</td>
                      <td>{accounts.filter((a) => a.country === country).length}</td>
                      <td>{repsList.filter((r) => r.country === country).map((r) => r.name).join(", ") || <span style={{ color: "var(--danger)" }}>Aucun représentant affecté</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel" style={{ marginTop: 18 }}>
              <h3>Objectifs par typologie(s) de réseau et catégorie(s) produit</h3>
              <div className="filter-row">
                <select value={objForm.rep} onChange={(e) => setObjForm({ ...objForm, rep: e.target.value })}>
                  <option value="">Représentant...</option>
                  {repsList.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                <select value={objForm.metric} onChange={(e) => setObjForm({ ...objForm, metric: e.target.value })}>
                  <option>Chiffre d'affaires</option>
                  <option>Précommande</option>
                </select>
                <select value={objForm.period} onChange={(e) => setObjForm({ ...objForm, period: e.target.value })}>
                  <option>Mensuel</option><option>Trimestre</option><option>Annuel</option>
                </select>
                <input type="number" placeholder="Objectif €" value={objForm.target} onChange={(e) => setObjForm({ ...objForm, target: e.target.value })}
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, width: 130 }} />
                <button className="btn primary" onClick={assignObjective}>Assigner</button>
              </div>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Typologie(s) de réseau concernées (plusieurs possibles — ex. Surf Shop + Skate Shop ensemble, ou Opticien seul)</p>
              <CatalogSelector catalogNames={TYPOLOGIES.map((ty) => ty.fr)} active={objForm.typologies.map((code) => typologyLabel(code, "fr"))} onToggle={(label) => { const ty = TYPOLOGIES.find((t) => t.fr === label); if (ty) toggleObjTypology(ty.code); }} />
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 6px" }}>Catégorie(s) de produit concernées (plusieurs possibles — ex. Premium + Classic ensemble, ou Optics seul)</p>
              <CatalogSelector catalogNames={CATEGORIES} active={objForm.categories} onToggle={toggleObjCategory} />
              <table className="data-table">
                <thead><tr><th>Représentant</th><th>Type</th><th>Secteur(s)</th><th>Typologie(s)</th><th>Catégories</th><th>Objectif</th><th>Période</th></tr></thead>
                <tbody>
                  {objectives.map((o) => (
                    <tr key={o.id}>
                      <td>{o.rep}</td>
                      <td><span className="typology-badge" style={o.metric === "Précommande" ? { background: "var(--gold-soft)", color: "#8A6A0E" } : {}}>{o.metric || "Chiffre d'affaires"}</span></td>
                      <td>{[...new Set(o.typologies.map((c) => sectorFor(c)))].map((s) => <span className="typology-badge" key={s} style={{ marginRight: 4 }}>{s}</span>)}</td>
                      <td>{o.typologies.map((c) => typologyLabel(c, lang)).join(", ")}</td>
                      <td>{o.categories.join(", ")}</td><td>{money(o.target)}</td><td>{o.period}</td>
                    </tr>
                  ))}
                  {objectives.length === 0 && <tr><td colSpan={7} style={{ color: "var(--ink-soft)" }}>Aucun objectif défini.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
        {role === "directeur" && view === "bestsellers" && (() => {
          return (
            <>
              <h1 className="page-title">Data</h1>
              <p className="page-sub">Bestsellers, analyses détaillées et extraction de données.</p>
              <div className="cat-tabs">
                <button className={`cat-tab ${dataSubview === "bestsellers" ? "active" : ""}`} onClick={() => setDataSubview("bestsellers")}>Bestsellers</button>
                <button className={`cat-tab ${dataSubview === "analytics" ? "active" : ""}`} onClick={() => setDataSubview("analytics")}>Analytics</button>
                <button className={`cat-tab ${dataSubview === "extraction" ? "active" : ""}`} onClick={() => setDataSubview("extraction")}>Extraction</button>
              </div>

              {dataSubview === "bestsellers" && (
                <>
                  <p className="page-sub">Filtre par période, représentant(s), typologie(s) de client et catégorie(s) de produit — comparatif N vs N-1.</p>
                  <div className="filter-row">
                    <select value={bfPeriod} onChange={(e) => setBfPeriod(e.target.value)}>
                      <option value="mois">{t("period")} : Mois</option>
                      <option value="trimestre">{t("period")} : Trimestre</option>
                      <option value="annee">{t("period")} : Année</option>
                    </select>
                  </div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Représentant(s)</p>
                  <CatalogSelector catalogNames={repsList.map((r) => r.name)} active={bfReps} onToggle={toggleBfRep} />
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Typologie(s) de client</p>
                  <CatalogSelector catalogNames={TYPOLOGIES.map((ty) => ty.fr)} active={bfTypologies.map((c) => typologyLabel(c, "fr"))} onToggle={(label) => { const ty = TYPOLOGIES.find((t) => t.fr === label); if (ty) toggleBfTypology(ty.code); }} />
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Catégorie(s) de produit</p>
                  <CatalogSelector catalogNames={CATEGORIES} active={bfCategories} onToggle={toggleBfCategory} />
                  <div className="panel" style={{ marginTop: 12 }}>
                    <table className="data-table">
                      <thead><tr><th>Produit</th><th>Unités</th><th>CA (N)</th><th>CA (N-1)</th><th>Évolution</th><th>Représentant</th><th>Typologie</th><th>Catégorie</th></tr></thead>
                      <tbody>
                        {filteredBestsellers.map((b, idx) => {
                          const delta = Math.round(((b.ca - b.caPrev) / b.caPrev) * 100);
                          return (
                            <tr key={idx}>
                              <td>{b.name}</td><td>{b.units}</td><td>{money(b.ca)}</td><td>{money(b.caPrev)}</td>
                              <td style={{ color: delta >= 0 ? "var(--teal)" : "var(--danger)", fontWeight: 700 }}>{delta >= 0 ? "+" : ""}{delta}%</td>
                              <td>{b.rep}</td>
                              <td><span className="typology-badge">{typologyLabel(b.typology, lang)}</span></td>
                              <td>{b.category}</td>
                            </tr>
                          );
                        })}
                        {filteredBestsellers.length === 0 && <tr><td colSpan={8} style={{ color: "var(--ink-soft)" }}>Aucun résultat pour ces filtres.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {dataSubview === "analytics" && (() => {
                const ordersA = ordersInPeriod(anaPeriodA);
                const ordersB = ordersInPeriod(anaPeriodB);
                const totalA = ordersA.reduce((s, o) => s + o.total, 0);
                const totalB = ordersB.reduce((s, o) => s + o.total, 0);
                const deltaAB = totalB > 0 ? Math.round(((totalA - totalB) / totalB) * 100) : 0;
                const fermeA = ordersA.filter((o) => !o.isPreOrder).reduce((s, o) => s + o.total, 0);
                const precoA = ordersA.filter((o) => o.isPreOrder).reduce((s, o) => s + o.total, 0);

                const aggBy = (keyFn) => {
                  const agg = {};
                  ordersA.forEach((o) => { const k = keyFn(o) || "—"; agg[k] = (agg[k] || 0) + o.total; });
                  return Object.entries(agg).sort((a, b) => b[1] - a[1]);
                };
                const byRep = aggBy((o) => o.rep);
                const byCountry = aggBy((o) => { const a = accounts.find((a) => a.name === o.account); return a ? a.country : null; });
                const byClient = aggBy((o) => o.account);
                const byCategoryAgg = {};
                ordersA.forEach((o) => (o.items || []).forEach((it) => {
                  const p = catalog.find((pp) => pp.ref === it.ref || pp.id === it.id);
                  const cat = p ? p.category : "Non identifié";
                  byCategoryAgg[cat] = (byCategoryAgg[cat] || 0) + (it.offert ? 0 : it.price * it.qty);
                }));
                const byCategoryRows = Object.entries(byCategoryAgg).sort((a, b) => b[1] - a[1]);

                return (
                  <>
                    <p className="page-sub">Analyse détaillée — filtre par période A vs période B, représentant(s), Master Rep(s), pays, client, catégorie(s) de produit et type de commande.</p>

                    <div className="panel">
                      <h3>Filtres</h3>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Période A</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input type="date" value={anaPeriodA.from} onChange={(e) => setAnaPeriodA({ ...anaPeriodA, from: e.target.value })} style={{ padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 5 }} />
                            <input type="date" value={anaPeriodA.to} onChange={(e) => setAnaPeriodA({ ...anaPeriodA, to: e.target.value })} style={{ padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 5 }} />
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Période B (comparaison)</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input type="date" value={anaPeriodB.from} onChange={(e) => setAnaPeriodB({ ...anaPeriodB, from: e.target.value })} style={{ padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 5 }} />
                            <input type="date" value={anaPeriodB.to} onChange={(e) => setAnaPeriodB({ ...anaPeriodB, to: e.target.value })} style={{ padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 5 }} />
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Type de commande</p>
                          <select value={anaMetric} onChange={(e) => setAnaMetric(e.target.value)} style={{ padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 5 }}>
                            <option value="both">Fermes + Précommandes</option>
                            <option value="ferme">Commandes fermes uniquement</option>
                            <option value="precommande">Précommandes uniquement</option>
                          </select>
                        </div>
                      </div>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Représentant(s)</p>
                      <CatalogSelector catalogNames={repsList.map((r) => r.name)} active={anaReps} onToggle={toggleAnaRep} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Master Rep(s)</p>
                      <CatalogSelector catalogNames={masterRepsList.map((mr) => mr.name)} active={anaMasterReps} onToggle={toggleAnaMasterRep} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Pays</p>
                      <CatalogSelector catalogNames={[...new Set(accounts.map((a) => a.country))]} active={anaCountries} onToggle={toggleAnaCountry} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Catégorie(s) de produit</p>
                      <CatalogSelector catalogNames={CATEGORIES} active={anaCategories} onToggle={toggleAnaCategory} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Typologie(s) de client</p>
                      <CatalogSelector catalogNames={TYPOLOGIES.map((ty) => ty.fr)} active={anaTypologies.map((c) => typologyLabel(c, "fr"))} onToggle={(label) => { const ty = TYPOLOGIES.find((t) => t.fr === label); if (ty) toggleAnaTypology(ty.code); }} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Client(s) — laisser vide pour tous les clients</p>
                      <CatalogSelector catalogNames={accounts.map((a) => a.name)} active={anaClients} onToggle={toggleAnaClient} />
                    </div>

                    <div className="cards-row">
                      <div className="stat-card">
                        <div className="stat-label">Période A</div>
                        <div className="stat-value">{money(totalA)}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Période B</div>
                        <div className="stat-value">{money(totalB)}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Évolution A vs B</div>
                        <div className="stat-value" style={{ color: deltaAB >= 0 ? "var(--teal)" : "var(--danger)" }}>{deltaAB >= 0 ? "+" : ""}{deltaAB}%</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Dont fermes / précommandes (période A)</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{money(fermeA)} / <span style={{ color: "var(--gold)" }}>{money(precoA)}</span></div>
                      </div>
                    </div>

                    <div className="panel">
                      <h3>Par représentant (période A)</h3>
                      <table className="data-table">
                        <thead><tr><th>Représentant</th><th>Montant</th></tr></thead>
                        <tbody>
                          {byRep.map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}
                          {byRep.length === 0 && <tr><td colSpan={2} style={{ color: "var(--ink-soft)" }}>Aucune commande sur cette période / ces filtres.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="panel">
                      <h3>Par pays (période A)</h3>
                      <table className="data-table">
                        <thead><tr><th>Pays</th><th>Montant</th></tr></thead>
                        <tbody>{byCountry.map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="panel">
                      <h3>Par client (période A)</h3>
                      <table className="data-table">
                        <thead><tr><th>Client</th><th>Montant</th></tr></thead>
                        <tbody>{byClient.map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="panel">
                      <h3>Par catégorie de produit (période A)</h3>
                      <table className="data-table">
                        <thead><tr><th>Catégorie</th><th>Montant</th></tr></thead>
                        <tbody>{byCategoryRows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              {dataSubview === "extraction" && (
                <div className="panel">
                  <h3>Extraction de données</h3>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>Exporte toutes les commandes, lignes de commande et fiches clients sur la période choisie, au format Excel.</p>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                    <div className="cc-field" style={{ flex: 1 }}><label>Du</label><input type="date" value={extractFrom} onChange={(e) => setExtractFrom(e.target.value)} /></div>
                    <div className="cc-field" style={{ flex: 1 }}><label>Au</label><input type="date" value={extractTo} onChange={(e) => setExtractTo(e.target.value)} /></div>
                  </div>
                  <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={exportDataExtract}>
                    <FileDown size={15} /> Extraire en Excel
                  </button>
                  <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>Le fichier contient 3 feuilles : Commandes, Lignes, Clients.</p>
                </div>
              )}
            </>
          );
        })()}
        {role === "rep" && view === "bestsellers" && (
          <>
            <h1 className="page-title">Data</h1>
            <p className="page-sub">Bestsellers et performance par client.</p>
            <div className="cat-tabs">
              <button className={`cat-tab ${repDataSubview === "bestsellers" ? "active" : ""}`} onClick={() => setRepDataSubview("bestsellers")}>Bestsellers</button>
              <button className={`cat-tab ${repDataSubview === "customer" ? "active" : ""}`} onClick={() => setRepDataSubview("customer")}>Customer Performance</button>
            </div>

            {repDataSubview === "bestsellers" && (
              <>
                <p className="page-sub">Tes meilleures ventes — filtre par client et par période, comparatif N vs N-1.</p>
                <div className="filter-row">
                  <select value={bfPeriod} onChange={(e) => { setBfPeriod(e.target.value); setBfGenerated(false); }}>
                    <option value="mois">{t("period")} : Mois</option>
                    <option value="trimestre">{t("period")} : Trimestre</option>
                    <option value="annee">{t("period")} : Année</option>
                  </select>
                  <select value={bfClient} onChange={(e) => { setBfClient(e.target.value); setBfGenerated(false); }}>
                    <option value="all">Client : {t("all")}</option>
                    {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                  <button className="btn primary" onClick={() => setBfGenerated(true)}>Générer</button>
                </div>
                {!bfGenerated && (
                  <p style={{ color: "var(--ink-soft)" }}>Choisis une période et, si tu veux, un client, puis clique sur "Générer" pour voir toutes les références vendues, classées par CA décroissant.</p>
                )}
                {bfGenerated && (
                  <div className="panel">
                    <table className="data-table">
                      <thead><tr><th>Produit</th><th>Unités</th><th>CA (N)</th><th>CA (N-1)</th><th>Évolution</th><th>Client</th></tr></thead>
                      <tbody>
                        {[...BESTSELLERS]
                          .filter((b) => b.rep === "Camille Dubois" && (bfClient === "all" || b.client === bfClient))
                          .sort((a, b) => b.ca - a.ca)
                          .map((b, idx) => {
                            const delta = Math.round(((b.ca - b.caPrev) / b.caPrev) * 100);
                            return (
                              <tr key={idx}>
                                <td>{b.name}</td><td>{b.units}</td><td>{money(b.ca)}</td><td>{money(b.caPrev)}</td>
                                <td style={{ color: delta >= 0 ? "var(--teal)" : "var(--danger)", fontWeight: 700 }}>{delta >= 0 ? "+" : ""}{delta}%</td>
                                <td>{b.client}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {repDataSubview === "customer" && (() => {
              const rangeN = getPeriodRange(cpPeriod, 0);
              const rangeN1 = getPeriodRange(cpPeriod, 1);
              const inScope = (o) => o.rep === "Camille Dubois" && (cpClient === "all" || o.account === cpClient);
              const ordersN = queue.filter((o) => inScope(o) && o.createdAt >= rangeN.from && o.createdAt <= rangeN.to);
              const ordersN1 = queue.filter((o) => inScope(o) && o.createdAt >= rangeN1.from && o.createdAt <= rangeN1.to);
              const sum = (arr, pred) => arr.filter(pred).reduce((s, o) => s + o.total, 0);
              const firmN = sum(ordersN, (o) => !o.isPreOrder), firmN1 = sum(ordersN1, (o) => !o.isPreOrder);
              const precoN = sum(ordersN, (o) => o.isPreOrder), precoN1 = sum(ordersN1, (o) => o.isPreOrder);
              const deltaPct = (n, n1) => (n1 > 0 ? Math.round(((n - n1) / n1) * 100) : n > 0 ? 100 : 0);
              const catAgg = (orders) => {
                const agg = {};
                CATEGORIES.forEach((c) => (agg[c] = 0));
                orders.forEach((o) => (o.items || []).forEach((it) => {
                  const p = catalog.find((pp) => pp.ref === it.ref || pp.id === it.id);
                  const cat = p ? p.category : "Non identifié";
                  agg[cat] = (agg[cat] || 0) + (it.offert ? 0 : it.price * it.qty);
                }));
                return agg;
              };
              const catN = catAgg(ordersN), catN1 = catAgg(ordersN1);
              const allCats = [...new Set([...Object.keys(catN), ...Object.keys(catN1)])];

              return (
                <>
                  <p className="page-sub">Comparatif commandes fermes et précommandes, détaillé par catégorie de produit, vs la même période l'an dernier.</p>
                  <div className="filter-row">
                    <select value={cpPeriod} onChange={(e) => { setCpPeriod(e.target.value); setCpGenerated(false); }}>
                      <option value="mois">{t("period")} : Mois</option>
                      <option value="trimestre">{t("period")} : Trimestre</option>
                      <option value="annee">{t("period")} : Année</option>
                    </select>
                    <select value={cpClient} onChange={(e) => { setCpClient(e.target.value); setCpGenerated(false); }}>
                      <option value="all">Client : {t("all")}</option>
                      {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                    <button className="btn primary" onClick={() => setCpGenerated(true)}>Générer</button>
                  </div>

                  {!cpGenerated && (
                    <p style={{ color: "var(--ink-soft)" }}>Choisis une période et, si tu veux, un client, puis clique sur "Générer".</p>
                  )}

                  {cpGenerated && (
                    <>
                      <div className="cards-row">
                        <div className="stat-card">
                          <div className="stat-label">Commandes fermes (N vs N-1)</div>
                          <div className="stat-value">{money(firmN)} <span style={{ fontSize: 13, color: deltaPct(firmN, firmN1) >= 0 ? "var(--teal)" : "var(--danger)" }}>({deltaPct(firmN, firmN1) >= 0 ? "+" : ""}{deltaPct(firmN, firmN1)}%)</span></div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>N-1 : {money(firmN1)}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Précommandes (N vs N-1)</div>
                          <div className="stat-value" style={{ color: "var(--gold)" }}>{money(precoN)} <span style={{ fontSize: 13, color: deltaPct(precoN, precoN1) >= 0 ? "var(--teal)" : "var(--danger)" }}>({deltaPct(precoN, precoN1) >= 0 ? "+" : ""}{deltaPct(precoN, precoN1)}%)</span></div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>N-1 : {money(precoN1)}</div>
                        </div>
                      </div>
                      <div className="panel">
                        <h3>Détail par catégorie (N vs N-1)</h3>
                        <table className="data-table">
                          <thead><tr><th>Catégorie</th><th>Montant (N)</th><th>Montant (N-1)</th><th>Évolution</th></tr></thead>
                          <tbody>
                            {allCats.map((cat) => {
                              const n = catN[cat] || 0, n1 = catN1[cat] || 0;
                              const d = deltaPct(n, n1);
                              return (
                                <tr key={cat}>
                                  <td>{cat}</td><td>{money(n)}</td><td>{money(n1)}</td>
                                  <td style={{ color: d >= 0 ? "var(--teal)" : "var(--danger)", fontWeight: 700 }}>{d >= 0 ? "+" : ""}{d}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}
        {role === "rep" && view === "agenda" && (
          <>
            <h1 className="page-title">Agenda</h1>
            <p className="page-sub">Rendez-vous, appels, déplacements et tâches — tout ce que tu dois faire, au même endroit.</p>
            <div className="cat-tabs">
              <button className={`cat-tab ${agendaSubview === "rdv" ? "active" : ""}`} onClick={() => setAgendaSubview("rdv")}>Rendez-vous</button>
              <button className={`cat-tab ${agendaSubview === "taches" ? "active" : ""}`} onClick={() => setAgendaSubview("taches")}>
                Tâches {tasks.filter((tk) => !tk.done).length > 0 && `(${tasks.filter((tk) => !tk.done).length})`}
              </button>
            </div>

            {agendaSubview === "rdv" && (
              <>
                {agendaEvents.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucun évènement planifié. Ajoute-en un depuis une fiche client.</p>}
                {[...agendaEvents].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((ev) => (
                  <div className="task-row panel" style={{ display: "flex", alignItems: "center" }} key={ev.id}>
                    <span style={{ cursor: "pointer" }} onClick={() => { const acc = accounts.find((a) => a.id === ev.accountId); if (acc) openFiche(acc); }}>
                      <strong>{ev.type}</strong> — <span style={{ textDecoration: "underline" }}>{ev.accountName}</span>{ev.note ? ` · ${ev.note}` : ""}
                    </span>
                    <span>{ev.date}{ev.time ? ` à ${ev.time}` : ""}</span>
                  </div>
                ))}
              </>
            )}

            {agendaSubview === "taches" && (
              <>
                <div className="panel">
                  <div className="filter-row">
                    <input placeholder="Intitulé de la tâche" value={taskForm.label} onChange={(e) => setTaskForm({ ...taskForm, label: e.target.value })}
                      style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5 }} />
                    <select value={taskForm.accountId} onChange={(e) => setTaskForm({ ...taskForm, accountId: e.target.value })}>
                      <option value="">Attribuée à : Moi-même</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input type="date" value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })}
                      style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5 }} />
                    <button className="btn primary" onClick={createTask}>Créer la tâche</button>
                  </div>
                </div>
                <div className="panel">
                  <h3>Tâches en cours</h3>
                  {tasks.filter((tk) => !tk.done).length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>Aucune tâche en attente.</p>}
                  {tasks.filter((tk) => !tk.done).map((tk) => (
                    <div className="task-row" key={tk.id}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={tk.done} onChange={() => toggleTaskDone(tk.id)} />
                        {tk.accountId ? (
                          <span style={{ cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => { const acc = accounts.find((a) => a.id === tk.accountId); if (acc) openFiche(acc); }}>
                            {tk.accountName}
                          </span>
                        ) : <span>{tk.accountName}</span>} — {tk.label}
                      </span>
                      <span style={{ color: isOverdue(tk.due) ? "var(--danger)" : "inherit" }}>{isOverdue(tk.due) ? "En retard" : tk.due}</span>
                    </div>
                  ))}
                </div>
                {tasks.some((tk) => tk.done) && (
                  <div className="panel">
                    <h3>Terminées</h3>
                    {tasks.filter((tk) => tk.done).map((tk) => (
                      <div className="task-row" key={tk.id} style={{ opacity: 0.6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={tk.done} onChange={() => toggleTaskDone(tk.id)} />
                          <span style={{ textDecoration: "line-through" }}>{tk.accountName} — {tk.label}</span>
                        </span>
                        <span>{tk.due}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
        {(role === "directeur" || role === "masterrep") && view === "agenda" && (() => {
          const teamReps = role === "masterrep" ? repsList.filter((r) => r.masterRep === currentMasterRep) : repsList;
          const teamNames = teamReps.map((r) => r.name);
          const visibleEvents = agendaEvents.filter((e) => (role === "masterrep" ? teamNames.includes(e.rep) : true) && (dirAgendaRep === "all" || e.rep === dirAgendaRep));
          return (
            <>
              <h1 className="page-title">Agenda équipe</h1>
              <p className="page-sub">Tous les rendez-vous, appels et déplacements planifiés par {role === "masterrep" ? "tes représentants" : "l'ensemble des représentants"}.</p>
              <div className="filter-row">
                <select value={dirAgendaRep} onChange={(e) => setDirAgendaRep(e.target.value)}>
                  <option value="all">{t("rep_filter")} : {t("all")}</option>
                  {teamReps.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              {visibleEvents.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucun évènement planifié pour ce filtre.</p>}
              {[...visibleEvents].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((ev) => (
                <div className="task-row panel" style={{ display: "flex", alignItems: "center" }} key={ev.id}>
                  <span style={{ cursor: "pointer" }} onClick={() => { const acc = accounts.find((a) => a.id === ev.accountId); if (acc) openFiche(acc); }}>
                    <strong>{ev.type}</strong> — <span style={{ textDecoration: "underline" }}>{ev.accountName}</span> · {ev.rep}{ev.note ? ` · ${ev.note}` : ""}
                  </span>
                  <span>{ev.date}{ev.time ? ` à ${ev.time}` : ""}</span>
                </div>
              ))}
            </>
          );
        })()}
        {role === "frontdesk" && view === "sav" && (
          <>
            <h1 className="page-title">Tickets SAV</h1>
            <p className="page-sub">Créés par les représentants depuis les fiches clients.</p>
            {savTickets.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucun ticket SAV.</p>}
            {savTickets.map((s) => (
              <div className="queue-card" key={s.id}>
                <div style={{ cursor: "pointer" }} onClick={() => { const acc = accounts.find((a) => a.id === s.accountId); if (acc) openFiche(acc); }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline" }}>{s.accountName}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{s.motif} · {s.date}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`queue-status ${s.status === "ouvert" ? "nouvelle" : "importée"}`}>{s.status === "ouvert" ? "Ouvert" : "Traité"}</span>
                  {s.status === "ouvert" && (
                    <button className="btn outline" onClick={() => setSavTickets((ts) => ts.map((x) => x.id === s.id ? { ...x, status: "traité" } : x))}>Marquer traité</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
        {role === "directeur" && view === "config" && (
          <>
            <h1 className="page-title">{t("nav_config")}</h1>
            <p className="page-sub">Aucune règle codée en dur — chaque règle a une portée (globale, pays ou représentant) et peut être activée/désactivée.</p>
            <div className="confidential-note" style={{ marginBottom: 16 }}>Le choix des catalogues actifs pour la prise de commande est géré par l'administrateur (Catalogue produits), pour éviter que deux écrans ne pilotent le même réglage.</div>
            <div className="panel">
              <table className="data-table">
                <thead><tr><th>Règle</th><th>Type</th><th>Valeur</th><th>Portée</th><th>Cible</th><th>Actif</th><th></th></tr></thead>
                <tbody>
                  {businessRules.map((r) => (
                    <tr key={r.id}>
                      <td>{r.label}</td>
                      <td>{r.type}</td>
                      <td style={{ color: "var(--ink-soft)" }}>
                        {r.type === "Frais de port"
                          ? `${money(Number(r.amount || 0))}${r.threshold ? ` — offerts dès ${money(Number(r.threshold))}` : ""}`
                          : (r.type === "Remise catégorie" || r.type === "Remise combo") && r.rate
                            ? `${r.rate}% sur ${(r.categories || []).join(" + ")}`
                            : r.value}
                      </td>
                      <td>{r.scope}</td>
                      <td>{r.target || "—"}</td>
                      <td><input type="checkbox" checked={r.active} onChange={() => toggleRuleActive(r.id)} /></td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button className="btn outline" style={{ padding: "5px 10px" }} onClick={() => setNewRuleForm({ ...r })}>Modifier</button>
                        <button className="btn outline" style={{ padding: "5px 10px" }} onClick={() => deleteRule(r.id)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn primary" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setNewRuleForm({ label: "", type: "Remise catégorie", value: "", scope: "Global", target: "", threshold: "" })}>
                <Plus size={15} /> Ajouter une règle
              </button>
            </div>
            <div className="panel">
              <h3>Répartition par représentant — qui a quoi</h3>
              <table className="data-table">
                <thead><tr><th>Représentant</th><th>Pays</th><th>Règles spécifiques appliquées</th></tr></thead>
                <tbody>
                  {repsList.map((r) => {
                    const applicable = businessRules.filter((br) => br.active && (
                      (br.scope === "Représentant" && br.target === r.name) ||
                      (br.scope === "Pays" && br.target === r.country)
                    ));
                    return (
                      <tr key={r.id}>
                        <td>{r.name}</td><td>{r.country}</td>
                        <td>{applicable.length ? applicable.map((a) => a.label).join(", ") : <span style={{ color: "var(--ink-soft)" }}>Règles globales uniquement</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="confidential-note"><Lock size={12} />Les taux de marge, seuils de remise et conditions commerciales détaillées restent strictement internes à cette section : jamais exposés au représentant, ni exportés, ni consultables ailleurs dans l'application.</div>
          </>
        )}

        {role === "admin" && view === "catalogue" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 className="page-title">Catalogue produits</h1>
                <p className="page-sub">{catalog.length} références — point central de gestion du catalogue.</p>
              </div>
              <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                onClick={() => setProductForm({ ...emptyProductForm })}>
                <Plus size={15} /> Nouvelle référence
              </button>
            </div>
            <div className="panel">
              <h3>Catalogues actifs pour la prise de commande</h3>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>Les catalogues désélectionnés n'apparaissent plus dans l'écran de commande des représentants.</p>
              <CatalogSelector catalogNames={catalogNames} active={activeCatalogs} onToggle={toggleCatalogSelection} />
              <table className="data-table" style={{ marginTop: 12 }}>
                <thead><tr><th>Catalogue</th><th>Références</th><th></th></tr></thead>
                <tbody>
                  {catalogNames.map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{catalog.filter((p) => (p.catalogName || "Sans catalogue") === name).length}</td>
                      <td><button className="btn outline" style={{ padding: "5px 10px" }} onClick={() => setDeleteCatalogTarget(name)}>Supprimer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>Supprimer un catalogue ne supprime pas les références : elles repassent en "Sans catalogue", à réaffecter ensuite.</p>
            </div>
            <div className="search-bar"><Search size={15} color="#8892A0" />
              <input placeholder="Rechercher réf, SKU, modèle, couleur..." value={adminSearch} onChange={(e) => { setAdminSearch(e.target.value); setAdminPage(1); }} />
            </div>
            <div className="filter-row">
              <select value={adminCatFilter} onChange={(e) => { setAdminCatFilter(e.target.value); setAdminPage(1); }}>
                <option value="all">Catégorie : Toutes</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={adminCatalogFilter} onChange={(e) => { setAdminCatalogFilter(e.target.value); setAdminPage(1); }}>
                <option value="all">Catalogue : Tous</option>
                {catalogNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={adminStockFilter} onChange={(e) => { setAdminStockFilter(e.target.value); setAdminPage(1); }}>
                <option value="all">Stock : Tous</option>
                {STOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={adminStatusFilter} onChange={(e) => { setAdminStatusFilter(e.target.value); setAdminPage(1); }}>
                <option value="all">Statut : Tous</option>
                {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(() => {
              const q = adminSearch.trim().toLowerCase();
              const results = catalog.filter((p) =>
                (adminCatFilter === "all" || p.category === adminCatFilter) &&
                (adminCatalogFilter === "all" || (p.catalogName || "Sans catalogue") === adminCatalogFilter) &&
                (adminStockFilter === "all" || p.stockStatus === adminStockFilter) &&
                (adminStatusFilter === "all" || p.productStatus === adminStatusFilter) &&
                (!q || [p.ref, p.label, p.model, p.color, p.category].join(" ").toLowerCase().includes(q))
              );
              const pageSize = 20;
              const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
              const page = Math.min(adminPage, pageCount);
              const pageResults = results.slice((page - 1) * pageSize, page * pageSize);
              return (
                <div className="panel">
                  <table className="data-table">
                    <thead><tr><th></th><th>Réf</th><th>Modèle / Couleur</th><th>Catégorie</th><th>FR</th><th>Export</th><th>CH</th><th>RRP</th><th>Qté</th><th>Stock</th><th>Statut</th><th>Modifié</th><th></th></tr></thead>
                    <tbody>
                      {pageResults.map((p) => (
                        <tr key={p.id}>
                          <td><img src={p.photoUrl || photoFor(p.label)} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} onError={(e) => { e.currentTarget.src = photoFor(p.label); }} /></td>
                          <td>{p.ref}</td>
                          <td>{p.model} {p.color ? `(${p.color})` : ""}</td>
                          <td><span className="typology-badge">{p.category}</span></td>
                          <td>{p.priceFR ? money(p.priceFR) : "—"}</td>
                          <td>{p.priceExport ? money(p.priceExport) : "—"}</td>
                          <td>{p.priceCH ? money(p.priceCH) : "—"}</td>
                          <td>{p.rrp ? money(p.rrp) : "—"}</td>
                          <td>{p.qty}</td>
                          <td><span className={`queue-status ${p.stockStatus === "En stock" ? "importée" : "nouvelle"}`}>{p.stockStatus}</span></td>
                          <td><span className={`queue-status ${p.productStatus === "Discontinué" ? "nouvelle" : "importée"}`}>{p.productStatus}</span></td>
                          <td style={{ fontSize: 11 }}>{p.lastModified}</td>
                          <td><button className="btn outline" style={{ padding: "5px 10px" }} onClick={() => setProductForm({ ...p, priceFR: p.priceFR ?? "", priceExport: p.priceExport ?? "", priceCH: p.priceCH ?? "" })}>Modifier</button></td>
                        </tr>
                      ))}
                      {pageResults.length === 0 && <tr><td colSpan={13} style={{ color: "var(--ink-soft)" }}>Aucune référence pour ces filtres.</td></tr>}
                    </tbody>
                  </table>
                  {pageCount > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 12, alignItems: "center" }}>
                      <button className="btn outline" disabled={page <= 1} onClick={() => setAdminPage(page - 1)}>Précédent</button>
                      <span style={{ fontSize: 12.5 }}>Page {page} / {pageCount} ({results.length} résultats)</span>
                      <button className="btn outline" disabled={page >= pageCount} onClick={() => setAdminPage(page + 1)}>Suivant</button>
                    </div>
                  )}
                </div>
              );
            })()}
            {catalogHistory.length > 0 && (
              <div className="panel">
                <h3>Historique des modifications</h3>
                {catalogHistory.slice(0, 8).map((h, i) => (
                  <div className="task-row" key={i}><span>{h.detail}</span><span>{h.date} · {h.user}</span></div>
                ))}
              </div>
            )}
          </>
        )}

        {role === "admin" && view === "import" && (
          <>
            <h1 className="page-title">Import en masse</h1>
            <p className="page-sub">Créer ou mettre à jour des références, ou des fiches clients, par fichier.</p>
            <div className="cat-tabs">
              <button className={`cat-tab ${adminImportSubview === "catalogue" ? "active" : ""}`} onClick={() => setAdminImportSubview("catalogue")}>Catalogue produits</button>
              <button className={`cat-tab ${adminImportSubview === "clients" ? "active" : ""}`} onClick={() => setAdminImportSubview("clients")}>Fiches clients</button>
            </div>

            {adminImportSubview === "catalogue" && (
              <>
            <div className="panel">
              <h3>1. Fichier de références</h3>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleCatalogFile}
                style={{ padding: 10, border: "1px dashed var(--line)", borderRadius: 6, width: "100%", fontSize: 13 }} />
              <button className="btn outline" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }} onClick={downloadImportTemplate}>
                <FileDown size={14} /> Télécharger le modèle de fichier
              </button>
            </div>

            {importedRows && importMapping && (
              <>
                <div className="panel">
                  <h3>2. Catalogue de rattachement</h3>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button className="btn" style={{
                      flex: 1, border: importCatalogMode === "existing" ? "1px solid var(--ink)" : "1px solid var(--line)",
                      background: importCatalogMode === "existing" ? "var(--ink)" : "white", color: importCatalogMode === "existing" ? "white" : "var(--ink-soft)",
                    }} onClick={() => setImportCatalogMode("existing")}>Catalogue existant</button>
                    <button className="btn" style={{
                      flex: 1, border: importCatalogMode === "new" ? "1px solid var(--ink)" : "1px solid var(--line)",
                      background: importCatalogMode === "new" ? "var(--ink)" : "white", color: importCatalogMode === "new" ? "white" : "var(--ink-soft)",
                    }} onClick={() => { setImportCatalogMode("new"); setImportCatalogName(""); }}>Nouveau catalogue</button>
                  </div>
                  {importCatalogMode === "existing" ? (
                    <select value={importCatalogName} onChange={(e) => setImportCatalogName(e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, width: "100%" }}>
                      <option value="">Choisir un catalogue...</option>
                      {catalogNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input value={importCatalogName} onChange={(e) => setImportCatalogName(e.target.value)}
                      placeholder="Nom du nouveau catalogue, ex : Hiver 2027"
                      style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, width: "100%" }} />
                  )}
                  {!importCatalogName && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 6 }}>Un catalogue doit être choisi ou créé avant de pouvoir importer.</p>}
                </div>
                <div className="panel">
                  <h3>3. Mapping des colonnes</h3>
                  {Object.keys(FIELD_PATTERNS).map((field) => (
                    <div className="config-row" key={field}>
                      <span>{field}</span>
                      <select value={importMapping[field]} onChange={(e) => setImportMapping({ ...importMapping, [field]: e.target.value })}
                        style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5 }}>
                        <option value="">— ignorer —</option>
                        {Object.keys(importedRows[0] || {}).map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                  {!importMapping.ref && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 6 }}>La colonne "ref" est obligatoire pour identifier les références.</p>}
                </div>

                <div className="panel">
                  <h3>4. Aperçu</h3>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    <table className="data-table">
                      <thead><tr>{Object.keys(importedRows[0] || {}).slice(0, 6).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                      <tbody>
                        {importedRows.slice(0, 10).map((row, i) => (
                          <tr key={i}>{Object.keys(importedRows[0] || {}).slice(0, 6).map((k) => <td key={k}>{String(row[k])}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {importSummary && (
                  <div className="panel">
                    <h3>5. Résumé avant validation</h3>
                    <div className="cards-row">
                      <div className="stat-card"><div className="stat-label">Lignes détectées</div><div className="stat-value">{importSummary.total}</div></div>
                      <div className="stat-card"><div className="stat-label">Nouvelles références</div><div className="stat-value" style={{ color: "var(--teal)" }}>{importSummary.created}</div></div>
                      <div className="stat-card"><div className="stat-label">Références à mettre à jour</div><div className="stat-value">{importSummary.updated}</div></div>
                      <div className="stat-card"><div className="stat-label">Erreurs (réf. manquante)</div><div className="stat-value" style={{ color: importSummary.errors ? "var(--danger)" : "inherit" }}>{importSummary.errors}</div></div>
                    </div>
                    <div className="filter-row">
                      <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                        <option value="both">Créer les nouvelles + mettre à jour les existantes</option>
                        <option value="new">Créer uniquement les nouvelles références</option>
                        <option value="update">Mettre à jour uniquement les références existantes</option>
                      </select>
                    </div>
                    <button className="btn primary" onClick={commitImport} disabled={!importMapping.ref || !importCatalogName.trim()}>Valider l'import</button>
                  </div>
                )}
              </>
            )}

            <div className="panel">
              <h3>Photos produits</h3>
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>L'import de masse des photos (associées par référence, ex. dossier ZIP ou liens) nécessite un stockage de fichiers réel côté serveur — non disponible dans ce prototype de démonstration. Prévu dans l'architecture réelle (section stockage objet de la spec technique). Pour l'instant, une photo se règle par référence via une URL, dans l'écran Catalogue.</p>
            </div>
              </>
            )}

            {adminImportSubview === "clients" && (
              <>
                <div className="panel">
                  <h3>1. Fichier de fiches clients</h3>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
                    Chaque client est affilié à un représentant : soit renseigné directement par le représentant à la création, soit par toi ici si tu l'affectes. Le rattachement à un Master Rep se fait ensuite depuis la fiche client, par la direction commerciale.
                  </p>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleClientImportFile}
                    style={{ padding: 10, border: "1px dashed var(--line)", borderRadius: 6, width: "100%", fontSize: 13 }} />
                  <button className="btn outline" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }} onClick={downloadClientImportTemplate}>
                    <FileDown size={14} /> Télécharger le modèle de fichier
                  </button>
                </div>

                {clientImportedRows && clientImportMapping && (
                  <>
                    <div className="panel">
                      <h3>2. Représentant par défaut</h3>
                      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>Utilisé pour les lignes sans colonne "représentant" mappée, ou pour les nouvelles fiches sans valeur renseignée.</p>
                      <select value={clientImportDefaultRep} onChange={(e) => setClientImportDefaultRep(e.target.value)}>
                        <option value="">Aucun (à affecter plus tard)</option>
                        {repsList.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </div>

                    <div className="panel">
                      <h3>3. Mapping des colonnes</h3>
                      {Object.keys(CLIENT_FIELD_PATTERNS).map((field) => (
                        <div className="config-row" key={field}>
                          <span>{field}</span>
                          <select value={clientImportMapping[field]} onChange={(e) => setClientImportMapping({ ...clientImportMapping, [field]: e.target.value })}
                            style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5 }}>
                            <option value="">— ignorer —</option>
                            {Object.keys(clientImportedRows[0] || {}).map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                      {!clientImportMapping.name && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 6 }}>La colonne "name" (raison sociale) est obligatoire pour identifier les fiches.</p>}
                    </div>

                    <div className="panel">
                      <h3>4. Aperçu</h3>
                      <div style={{ maxHeight: 220, overflow: "auto" }}>
                        <table className="data-table">
                          <thead><tr>{Object.keys(clientImportedRows[0] || {}).slice(0, 6).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                          <tbody>
                            {clientImportedRows.slice(0, 10).map((row, i) => (
                              <tr key={i}>{Object.keys(clientImportedRows[0] || {}).slice(0, 6).map((k) => <td key={k}>{String(row[k])}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {clientImportSummary && (
                      <div className="panel">
                        <h3>5. Résumé avant validation</h3>
                        <div className="cards-row">
                          <div className="stat-card"><div className="stat-label">Lignes détectées</div><div className="stat-value">{clientImportSummary.total}</div></div>
                          <div className="stat-card"><div className="stat-label">Nouvelles fiches</div><div className="stat-value" style={{ color: "var(--teal)" }}>{clientImportSummary.created}</div></div>
                          <div className="stat-card"><div className="stat-label">Fiches à mettre à jour</div><div className="stat-value">{clientImportSummary.updated}</div></div>
                          <div className="stat-card"><div className="stat-label">Erreurs (nom manquant)</div><div className="stat-value" style={{ color: clientImportSummary.errors ? "var(--danger)" : "inherit" }}>{clientImportSummary.errors}</div></div>
                        </div>
                        <div className="filter-row">
                          <select value={clientImportMode} onChange={(e) => setClientImportMode(e.target.value)}>
                            <option value="both">Créer les nouvelles + mettre à jour les existantes</option>
                            <option value="new">Créer uniquement les nouvelles fiches</option>
                            <option value="update">Mettre à jour uniquement les fiches existantes</option>
                          </select>
                        </div>
                        <button className="btn primary" onClick={commitClientImport} disabled={!clientImportMapping.name}>Valider l'import</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {role === "admin" && view === "config" && (
          <>
            <h1 className="page-title">{t("nav_config")}</h1>
            <p className="page-sub">La configuration commerciale (remises, taxes, conditions de paiement) est gérée par la direction commerciale. L'administrateur gère le catalogue, les imports et les aspects techniques.</p>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "var(--ink)", color: "white", padding: "10px 14px", borderRadius: 6, fontSize: 12.5, zIndex: 40 }}>
          {toast}
        </div>
      )}

      {accountForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nouvelle fiche</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setAccountForm(null)}><X size={18} /></button>
            </div>
            <AccountFormFields form={accountForm} setForm={setAccountForm} t={t} lang={lang} role={role} repsList={repsList} masterRepsList={masterRepsList} />
            <button className="btn primary" style={{ width: "100%" }} onClick={saveNewAccount}>{t("btn_create_fiche")}</button>
          </div>
        </div>
      )}

      {editForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Modifier la fiche</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setEditForm(null)}><X size={18} /></button>
            </div>
            <AccountFormFields form={editForm} setForm={setEditForm} t={t} lang={lang} role={role} repsList={repsList} masterRepsList={masterRepsList} />
            <button className="btn primary" style={{ width: "100%" }} onClick={saveEditForm}>Enregistrer les modifications</button>
          </div>
        </div>
      )}

      {newRepForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nouveau représentant</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setNewRepForm(null)}><X size={18} /></button>
            </div>
            <div className="cc-field"><label>Nom complet</label><input value={newRepForm.name} onChange={(e) => setNewRepForm({ ...newRepForm, name: e.target.value })} /></div>
            <div className="cc-field"><label>Email (pour l'envoi des identifiants)</label><input type="email" value={newRepForm.email} onChange={(e) => setNewRepForm({ ...newRepForm, email: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="cc-field" style={{ flex: 1 }}>
                <label>{t("label_country")}</label>
                <select value={newRepForm.country} onChange={(e) => setNewRepForm({ ...newRepForm, country: e.target.value })}>
                  {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="cc-field" style={{ flex: 1 }}><label>Région / territoire</label><input value={newRepForm.region} onChange={(e) => setNewRepForm({ ...newRepForm, region: e.target.value })} /></div>
            </div>
            <div className="cc-field"><label>Objectif CA initial (optionnel)</label><input type="number" value={newRepForm.objectif} onChange={(e) => setNewRepForm({ ...newRepForm, objectif: e.target.value })} /></div>
            <div className="cc-field">
              <label>Master Rep (optionnel)</label>
              <select value={newRepForm.masterRep || ""} onChange={(e) => setNewRepForm({ ...newRepForm, masterRep: e.target.value || null })}>
                <option value="">Aucun</option>
                {masterRepsList.map((mr) => <option key={mr.id} value={mr.name}>{mr.name}</option>)}
              </select>
            </div>
            <button className="btn primary" style={{ width: "100%" }} onClick={createRep}>Créer le compte et envoyer l'identifiant</button>
          </div>
        </div>
      )}

      {newMasterRepForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nouveau Master Rep</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setNewMasterRepForm(null)}><X size={18} /></button>
            </div>
            <div className="cc-field"><label>Nom complet</label><input value={newMasterRepForm.name} onChange={(e) => setNewMasterRepForm({ ...newMasterRepForm, name: e.target.value })} /></div>
            <div className="cc-field"><label>Email (pour l'envoi des identifiants)</label><input type="email" value={newMasterRepForm.email} onChange={(e) => setNewMasterRepForm({ ...newMasterRepForm, email: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="cc-field" style={{ flex: 1 }}>
                <label>{t("label_country")}</label>
                <select value={newMasterRepForm.country} onChange={(e) => setNewMasterRepForm({ ...newMasterRepForm, country: e.target.value })}>
                  {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="cc-field" style={{ flex: 1 }}><label>Zone / région</label><input value={newMasterRepForm.region} onChange={(e) => setNewMasterRepForm({ ...newMasterRepForm, region: e.target.value })} /></div>
            </div>
            <button className="btn primary" style={{ width: "100%" }} onClick={createMasterRep}>Créer le compte et envoyer l'identifiant</button>
          </div>
        </div>
      )}

      {notifPanelOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 380 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Notifications</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setNotifPanelOpen(false)}><X size={18} /></button>
            </div>
            {notifications.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Aucune notification pour l'instant.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="task-row" style={{ cursor: "pointer", opacity: n.read ? 0.55 : 1, alignItems: "flex-start" }}
                onClick={() => {
                  setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                  const acc = accounts.find((a) => a.id === n.accountId);
                  if (acc) { openFiche(acc); setNotifPanelOpen(false); }
                }}>
                <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", marginTop: 5, flexShrink: 0 }} />}
                  <span>{n.message}</span>
                </span>
                <span style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>{new Date(n.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
            {notifications.some((n) => !n.read) && (
              <button className="btn outline" style={{ width: "100%", marginTop: 10 }}
                onClick={() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))}>
                Tout marquer comme lu
              </button>
            )}
          </div>
        </div>
      )}

      {orderDetail && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Détail de la commande — {orderDetail.account} {orderDetail.isPreOrder && <span className="offert-badge" style={{ marginLeft: 6 }}>Précommande</span>}</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setOrderDetail(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12 }}>Par {orderDetail.rep}</p>
            <div className="cards-row" style={{ marginBottom: 12 }}>
              <div className="stat-card">
                <div className="stat-label">Commande passée le</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{orderDetail.createdAt}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Livraison souhaitée</div>
                <div className="stat-value" style={{ fontSize: 16, color: orderDetail.desiredDeliveryDate ? "inherit" : "var(--ink-soft)" }}>
                  {orderDetail.desiredDeliveryDate || "Non précisée"}
                </div>
              </div>
            </div>
            {orderDetail.orderNote && (
              <div className="panel">
                <div className="task-row" style={{ alignItems: "flex-start" }}><span>Note du représentant</span><span style={{ textAlign: "right", maxWidth: "70%" }}>{orderDetail.orderNote}</span></div>
              </div>
            )}
            {(orderDetail.categoryBreakdown || []).map((cat, i) => (
              <div className="cat-block panel" key={i}>
                <div className="cat-head">
                  <h4>{cat.category}</h4>
                  <span className={`typology-badge`} style={{ background: cat.discountApplied ? "var(--teal-soft)" : "#EFECE2", color: cat.discountApplied ? "var(--teal)" : "var(--ink-soft)" }}>
                    {cat.discountApplied ? `Remise ${Math.round(cat.discountRate * 100)} % appliquée` : "Aucune remise"}
                  </span>
                </div>
                {cat.items.map((it, idx) => (
                  <div className="line-item" key={idx}>
                    <span>
                      {it.qty} × {it.label} {it.offert && <span className="offert-badge">Offert</span>}
                      {!orderDetail.isPreOrder && it.stockStatus === "Réassort prévu" && (
                        <span className="offert-badge" style={{ background: "var(--gold-soft)", color: "#8A6A0E", marginLeft: 4 }}>Reliquat</span>
                      )}
                    </span>
                    <span>{it.offert ? "0 €" : money(it.price * it.qty)}</span>
                  </div>
                ))}
                <div className="cat-subtotal">
                  <span>Sous-total {cat.discountApplied ? "(remise appliquée)" : "(brut)"} — {cat.items.reduce((s, it) => s + it.qty, 0)} unité(s)</span>
                  <span>{money(cat.discountApplied ? cat.subtotal * (1 - cat.discountRate) : cat.subtotal)}</span>
                </div>
              </div>
            ))}
            {!orderDetail.categoryBreakdown && (orderDetail.items || []).map((it, idx) => (
              <div className="line-item" key={idx}><span>{it.qty} × {it.label}</span><span>{money(it.price * it.qty)}</span></div>
            ))}
            {typeof orderDetail.shippingFee === "number" && (
              <div className="task-row">
                <span>Frais de port</span>
                <span>{orderDetail.shippingFee === 0 ? <span className="offert-badge">Offert</span> : money(orderDetail.shippingFee)}</span>
              </div>
            )}
            <div className="grand-total"><span>Total</span><span>{money(orderDetail.total)}</span></div>
            <button className="btn outline" style={{ width: "100%" }} onClick={() => setOrderDetail(null)}>Fermer</button>
          </div>
        </div>
      )}

      {exportCheck && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Vérification avant import Dolibarr</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setExportCheck(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>{exportCheck.order.account} — {money(exportCheck.order.total)}</p>
            {exportCheck.checks.map((c, i) => (
              <div className="task-row" key={i}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.ok ? <Check size={14} color="var(--teal)" /> : <X size={14} color="var(--danger)" />}
                  {c.label}
                </span>
              </div>
            ))}
            {exportCheck.checks.some((c) => !c.ok) && (
              <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>Des informations sont manquantes — le fichier peut quand même être généré, mais risque d'être rejeté ou incomplet à l'import dans Dolibarr. Corrige la fiche client si besoin avant de continuer.</p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn outline" style={{ flex: 1 }} onClick={() => setExportCheck(null)}>Annuler</button>
              <button className="btn primary" style={{ flex: 1 }} onClick={confirmExport}>Confirmer et télécharger</button>
            </div>
          </div>
        </div>
      )}

      {deleteCatalogTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Supprimer ce catalogue ?</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setDeleteCatalogTarget(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              "{deleteCatalogTarget}" ({catalog.filter((p) => (p.catalogName || "Sans catalogue") === deleteCatalogTarget).length} références) sera retiré de la liste des catalogues.
              Les références concernées ne seront pas supprimées — elles passeront en "Sans catalogue" et resteront à réaffecter.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn outline" style={{ flex: 1 }} onClick={() => setDeleteCatalogTarget(null)}>Annuler</button>
              <button className="btn primary" style={{ flex: 1, background: "var(--danger)" }} onClick={() => deleteCatalog(deleteCatalogTarget)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {productForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{productForm.id ? "Modifier la référence" : "Nouvelle référence"}</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setProductForm(null)}><X size={18} /></button>
            </div>
            <ProductFormFields form={productForm} setForm={setProductForm} catalogNames={catalogNames} />
            <button className="btn primary" style={{ width: "100%" }} onClick={saveProduct}>{productForm.id ? "Enregistrer les modifications" : "Créer la référence"}</button>
          </div>
        </div>
      )}

      {newRuleForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{newRuleForm.id ? "Modifier la règle" : "Nouvelle règle commerciale"}</h3>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setNewRuleForm(null)}><X size={18} /></button>
            </div>
            <div className="cc-field"><label>Libellé</label><input value={newRuleForm.label} onChange={(e) => setNewRuleForm({ ...newRuleForm, label: e.target.value })} /></div>
            <div className="cc-field">
              <label>Type</label>
              <select value={newRuleForm.type} onChange={(e) => setNewRuleForm({ ...newRuleForm, type: e.target.value })}>
                <option>Remise catégorie</option><option>Remise combo</option><option>Frais de port</option>
                <option>Display</option><option>Paiement</option><option>Taxe</option><option>Export</option>
              </select>
            </div>
            <div className="cc-field"><label>Valeur (texte libre)</label><input value={newRuleForm.value} onChange={(e) => setNewRuleForm({ ...newRuleForm, value: e.target.value })} placeholder="ex : Taux à définir" /></div>
            {newRuleForm.type === "Remise catégorie" && (
              <>
                <div className="cc-field">
                  <label>Catégorie concernée</label>
                  <select value={newRuleForm.category || ""} onChange={(e) => setNewRuleForm({ ...newRuleForm, category: e.target.value, categories: [e.target.value] })}>
                    <option value="">Choisir...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cc-field">
                  <label>Taux de remise (%)</label>
                  <input type="number" value={newRuleForm.rate || ""} onChange={(e) => setNewRuleForm({ ...newRuleForm, rate: e.target.value })} placeholder="ex : 10" />
                </div>
              </>
            )}
            {newRuleForm.type === "Remise combo" && (
              <>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Catégories concernées ensemble</p>
                <CatalogSelector catalogNames={CATEGORIES} active={newRuleForm.categories || []}
                  onToggle={(cat) => setNewRuleForm({ ...newRuleForm, categories: (newRuleForm.categories || []).includes(cat) ? newRuleForm.categories.filter((c) => c !== cat) : [...(newRuleForm.categories || []), cat] })} />
                <div className="cc-field" style={{ marginTop: 10 }}>
                  <label>Taux de remise (%)</label>
                  <input type="number" value={newRuleForm.rate || ""} onChange={(e) => setNewRuleForm({ ...newRuleForm, rate: e.target.value })} placeholder="ex : 12" />
                </div>
              </>
            )}
            {newRuleForm.type === "Frais de port" && (
              <>
                <div className="cc-field">
                  <label>Montant des frais de port par défaut (€ HT)</label>
                  <input type="number" value={newRuleForm.amount || ""} onChange={(e) => setNewRuleForm({ ...newRuleForm, amount: e.target.value })} placeholder="ex : 9.60" />
                </div>
                <div className="cc-field">
                  <label>Seuil de commande à partir duquel ils sont offerts automatiquement (optionnel, € HT)</label>
                  <input type="number" value={newRuleForm.threshold || ""} onChange={(e) => setNewRuleForm({ ...newRuleForm, threshold: e.target.value })} placeholder="ex : 500" />
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <div className="cc-field" style={{ flex: 1 }}>
                <label>Portée</label>
                <select value={newRuleForm.scope} onChange={(e) => setNewRuleForm({ ...newRuleForm, scope: e.target.value, target: "" })}>
                  <option>Global</option><option>Pays</option><option>Représentant</option>
                </select>
              </div>
              {newRuleForm.scope !== "Global" && (
                <div className="cc-field" style={{ flex: 1 }}>
                  <label>Cible</label>
                  <select value={newRuleForm.target} onChange={(e) => setNewRuleForm({ ...newRuleForm, target: e.target.value })}>
                    <option value="">Choisir...</option>
                    {newRuleForm.scope === "Pays"
                      ? COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)
                      : repsList.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <button className="btn primary" style={{ width: "100%" }} onClick={saveRule}>{newRuleForm.id ? "Enregistrer les modifications" : "Ajouter la règle"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Route / map view ================= */

function RouteView({ accounts, routeStops, toggleRouteStop, routeComputed, setRouteComputed, openFiche, t, embedded, showRepFilters, repsList, masterRepsList }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState([]);
  const [typologyFilter, setTypologyFilter] = useState([]);
  const [repFilterSel, setRepFilterSel] = useState([]);
  const [masterRepFilterSel, setMasterRepFilterSel] = useState([]);
  const [startMode, setStartMode] = useState("address");
  const [startAddress, setStartAddress] = useState("");
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoCoords, setGeoCoords] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiItinerary, setAiItinerary] = useState(null);
  const [aiError, setAiError] = useState(null);

  const toggleTypeFilter = (v) => setTypeFilter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const toggleTypologyFilter = (label) => {
    const ty = TYPOLOGIES.find((t2) => t2.fr === label);
    if (!ty) return;
    setTypologyFilter((cur) => (cur.includes(ty.code) ? cur.filter((x) => x !== ty.code) : [...cur, ty.code]));
  };
  const toggleRepFilter = (name) => setRepFilterSel((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const toggleMasterRepFilter = (name) => setMasterRepFilterSel((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));

  // Coordonnées défensives : jamais NaN/undefined, toujours dans le cadre du SVG.
  const points = accounts.map((a) => {
    const lat = typeof a.lat === "number" && isFinite(a.lat) ? a.lat : 46.6;
    const lng = typeof a.lng === "number" && isFinite(a.lng) ? a.lng : 1.9;
    let x = ((lng + 5) / 15) * 400;
    let y = 260 - ((lat - 38) / 12) * 260;
    x = Math.max(14, Math.min(386, x));
    y = Math.max(14, Math.min(246, y));
    return { ...a, x, y };
  });

  const visiblePoints = points.filter((a) =>
    (typeFilter.length === 0 || typeFilter.includes(a.type)) &&
    (typologyFilter.length === 0 || typologyFilter.includes(a.typology)) &&
    (repFilterSel.length === 0 || repFilterSel.includes(a.ownerRep)) &&
    (masterRepFilterSel.length === 0 || masterRepFilterSel.includes(a.masterRep)) &&
    (!search.trim() || a.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const orderedStops = routeStops.map((id) => points.find((p) => p.id === id)).filter(Boolean);
  const totalKm = routeComputed ? Math.round(orderedStops.length * 38 + Math.random() * 10) : null;

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoStatus("error"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoStatus("done"); },
      () => setGeoStatus("error"),
      { timeout: 8000 }
    );
  };

  const askClaudeForItinerary = async () => {
    setAiLoading(true); setAiError(null); setAiItinerary(null);
    try {
      const startLabel = startMode === "geo"
        ? (geoCoords ? `Position GPS actuelle (${geoCoords.lat.toFixed(4)}, ${geoCoords.lng.toFixed(4)})` : "Position GPS non disponible")
        : (startAddress.trim() || "Non précisé — pars d'un point central");
      const stopsInfo = orderedStops.length > 0 ? orderedStops : visiblePoints;
      const payload = stopsInfo.map((p) => ({
        nom: p.name,
        type: p.type,
        adresse: [p.billing?.street, p.billing?.postalCode, p.billing?.city, p.country].filter(Boolean).join(", "),
      }));
      const prompt = `Tu es un assistant qui optimise les tournées d'un représentant commercial.
Point de départ : ${startLabel}.
Chaque rendez-vous dure environ 1h30. La journée commence à 9h00.
Voici les points de vente à visiter (${payload.length}) : ${JSON.stringify(payload)}.
Propose un ordre de visite optimisé pour limiter les déplacements, avec une heure d'arrivée estimée pour chaque étape et une courte justification globale de l'ordre choisi.
Réponds uniquement avec un JSON valide, sans texte autour, sous la forme exacte :
{"itinerary":[{"nom":"...","heure":"09:00","note":"..."}],"resume":"..."}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map((b) => b.text || "").join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiItinerary(parsed);
    } catch (e) {
      setAiError("Impossible de générer l'itinéraire pour le moment. Réessaie dans un instant.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      {!embedded && <h1 className="page-title">{t("title_carte")}</h1>}
      <p className="page-sub" style={embedded ? { marginBottom: 10 } : {}}>{t("sub_carte")}</p>

      <div className="search-bar"><Search size={15} color="#8892A0" />
        <input placeholder="Rechercher un client sur la carte..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Type</p>
      <CatalogSelector catalogNames={["client", "prospect"]} active={typeFilter} onToggle={toggleTypeFilter} />
      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Typologie de client</p>
      <CatalogSelector catalogNames={TYPOLOGIES.map((ty) => ty.fr)} active={typologyFilter.map((c) => typologyLabel(c, "fr"))} onToggle={toggleTypologyFilter} />
      {showRepFilters && (
        <>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Représentant</p>
          <CatalogSelector catalogNames={(repsList || []).map((r) => r.name)} active={repFilterSel} onToggle={toggleRepFilter} />
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "10px 0 6px" }}>Master Rep</p>
          <CatalogSelector catalogNames={(masterRepsList || []).map((mr) => mr.name)} active={masterRepFilterSel} onToggle={toggleMasterRepFilter} />
        </>
      )}

      <div className="panel" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
        <svg viewBox="0 0 400 260" style={{ width: "100%", display: "block", background: "#EAF0EE" }}>
          <rect width="400" height="260" fill="#EAF0EE" />
          {routeComputed && orderedStops.length > 1 && (
            <polyline
              points={orderedStops.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="#0F6D66" strokeWidth="2" strokeDasharray="5,4"
            />
          )}
          {visiblePoints.map((a) => {
            const stopIndex = routeStops.indexOf(a.id);
            return (
              <g key={a.id} onClick={() => (showRepFilters || routeComputed ? openFiche(a) : toggleRouteStop(a.id))} style={{ cursor: "pointer" }}>
                <circle cx={a.x} cy={a.y} r={stopIndex >= 0 ? 9 : 7}
                  fill={stopIndex >= 0 ? "#C9A227" : a.type === "client" ? "#0F6D66" : "#8892A0"}
                  stroke="white" strokeWidth="2" />
                {stopIndex >= 0 && <text x={a.x} y={a.y + 3} fontSize="8" fill="white" textAnchor="middle" fontWeight="800">{stopIndex + 1}</text>}
                <text x={Math.min(a.x + 11, 330)} y={a.y + 4} fontSize="9" fill="#101828">{a.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {visiblePoints.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>Aucun point ne correspond à ces filtres.</p>}

      {showRepFilters ? (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 12 }}>
          {visiblePoints.length} client(s)/prospect(s) affiché(s) selon les filtres — clique un point pour ouvrir sa fiche.
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F6D66", display: "inline-block" }} /> Client</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8892A0", display: "inline-block" }} /> Prospect</span>
        </p>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>
            {routeStops.length} point(s) sélectionné(s) — clique un point pour l'ajouter à la tournée.
            {routeComputed && ` · ~${totalKm} km estimés`}
          </p>
          <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6 }}
            disabled={routeStops.length < 2}
            onClick={() => setRouteComputed(true)}>
            <Route size={15} /> {t("btn_optimize")}
          </button>
        </div>
      )}

      {!showRepFilters && routeComputed && (
        <>
          <div className="panel" style={{ marginTop: 14 }}>
            <h3>Ordre de tournée (estimation par distance)</h3>
            {orderedStops.map((p, idx) => (
              <div className="task-row" key={p.id}><span>{idx + 1}. {p.name}</span><span>{p.country}</span></div>
            ))}
          </div>

          <div className="panel">
            <h3>Point de départ</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="btn outline" style={{ flex: 1, background: startMode === "address" ? "var(--ink)" : "white", color: startMode === "address" ? "white" : "var(--ink-soft)" }}
                onClick={() => setStartMode("address")}>Adresse</button>
              <button className="btn outline" style={{ flex: 1, background: startMode === "geo" ? "var(--ink)" : "white", color: startMode === "geo" ? "white" : "var(--ink-soft)" }}
                onClick={() => setStartMode("geo")}>Ma position</button>
            </div>
            {startMode === "address" ? (
              <input placeholder="ex : 12 rue de la Paix, 75002 Paris" value={startAddress} onChange={(e) => setStartAddress(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13.5 }} />
            ) : (
              <div>
                <button className="btn outline" onClick={useMyLocation} disabled={geoStatus === "loading"}>
                  {geoStatus === "loading" ? "Localisation en cours..." : "Notifier ma géolocalisation"}
                </button>
                {geoStatus === "done" && geoCoords && <p style={{ fontSize: 11.5, color: "var(--teal)", marginTop: 6 }}>Position détectée : {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}</p>}
                {geoStatus === "error" && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 6 }}>Géolocalisation indisponible — vérifie l'autorisation de ton navigateur, ou saisis une adresse.</p>}
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Proposition d'itinéraire par Claude</h3>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
              Claude tient compte du point de départ et d'une durée de rendez-vous d'environ 1h30 pour proposer un ordre de passage et des horaires estimés.
            </p>
            <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={askClaudeForItinerary} disabled={aiLoading}>
              <Route size={15} /> {aiLoading ? "Génération en cours..." : "Demander à Claude un itinéraire optimisé"}
            </button>
            {aiError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{aiError}</p>}
            {aiItinerary && (
              <div style={{ marginTop: 12 }}>
                {aiItinerary.resume && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 8 }}>{aiItinerary.resume}</p>}
                {(aiItinerary.itinerary || []).map((step, idx) => (
                  <div className="task-row" key={idx}>
                    <span>{idx + 1}. {step.nom}{step.note ? ` — ${step.note}` : ""}</span>
                    <span style={{ fontWeight: 700 }}>{step.heure}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ================= Catalogue view ================= */

function CatalogSelector({ catalogNames, active, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {catalogNames.map((name) => {
        const on = active.includes(name);
        return (
          <button key={name} onClick={() => onToggle(name)}
            style={{
              padding: "7px 13px", borderRadius: 16, fontSize: 12.5, cursor: "pointer",
              border: on ? "1px solid var(--ink)" : "1px solid var(--line)",
              background: on ? "var(--ink)" : "white", color: on ? "white" : "var(--ink-soft)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {on && <Check size={12} />} {name}
          </button>
        );
      })}
    </div>
  );
}

function ProductFormFields({ form, setForm, catalogNames }) {
  const setField = (key, val) => setForm({ ...form, [key]: val });
  const [catalogMode, setCatalogMode] = useState(catalogNames.includes(form.catalogName) || !form.catalogName ? "existing" : "new");
  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><label>Référence / SKU</label><input value={form.ref} onChange={(e) => setField("ref", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>Catégorie</label>
          <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="cc-field">
        <label>Catalogue</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button type="button" onClick={() => setCatalogMode("existing")}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 4, fontSize: 11.5, cursor: "pointer",
              border: catalogMode === "existing" ? "1px solid var(--ink)" : "1px solid var(--line)",
              background: catalogMode === "existing" ? "var(--ink)" : "white", color: catalogMode === "existing" ? "white" : "var(--ink-soft)" }}>
            Catalogue existant
          </button>
          <button type="button" onClick={() => { setCatalogMode("new"); setField("catalogName", ""); }}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 4, fontSize: 11.5, cursor: "pointer",
              border: catalogMode === "new" ? "1px solid var(--ink)" : "1px solid var(--line)",
              background: catalogMode === "new" ? "var(--ink)" : "white", color: catalogMode === "new" ? "white" : "var(--ink-soft)" }}>
            Nouveau catalogue
          </button>
        </div>
        {catalogMode === "existing" ? (
          <select value={form.catalogName} onChange={(e) => setField("catalogName", e.target.value)}>
            <option value="">Choisir un catalogue...</option>
            {catalogNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input value={form.catalogName} onChange={(e) => setField("catalogName", e.target.value)} placeholder="Nom du nouveau catalogue, ex : Hiver 2027" />
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><label>Nom du modèle</label><input value={form.model} onChange={(e) => setField("model", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 1 }}><label>Couleur</label><input value={form.color} onChange={(e) => setField("color", e.target.value)} /></div>
      </div>
      <div className="cc-field"><label>Libellé (affiché aux représentants)</label><input value={form.label} onChange={(e) => setField("label", e.target.value)} /></div>
      <div className="cc-field"><label>Photo (URL)</label><input value={form.photoUrl} onChange={(e) => setField("photoUrl", e.target.value)} placeholder="https://..." /></div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 4px" }}>Prix (grilles indépendantes)</p>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><label>Prix France</label><input type="number" value={form.priceFR} onChange={(e) => setField("priceFR", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 1 }}><label>Prix Export</label><input type="number" value={form.priceExport} onChange={(e) => setField("priceExport", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 1 }}><label>Prix Suisse</label><input type="number" value={form.priceCH} onChange={(e) => setField("priceCH", e.target.value)} /></div>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: -6, marginBottom: 10 }}>Prix France pré-rempli depuis le prix de référence markup ×2,3 du catalogue importé — pas un prix d'achat fournisseur.</p>
      <div className="cc-field"><label>Prix de vente conseillé (RRP)</label><input type="number" value={form.rrp} onChange={(e) => setField("rrp", e.target.value)} /></div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 4px" }}>Stock</p>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><label>Quantité disponible</label><input type="number" value={form.qty} onChange={(e) => setField("qty", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>Statut du stock</label>
          <select value={form.stockStatus} onChange={(e) => setField("stockStatus", e.target.value)}>
            {STOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {form.stockStatus !== "En stock" && (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="cc-field" style={{ flex: 1 }}><label>Date de réassort (si connue)</label><input type="date" value={form.restockDate} onChange={(e) => setField("restockDate", e.target.value)} /></div>
          <div className="cc-field" style={{ flex: 1 }}><label>Quantité attendue</label><input type="number" value={form.expectedQty} onChange={(e) => setField("expectedQty", e.target.value)} /></div>
        </div>
      )}

      <div className="cc-field">
        <label>Statut du produit</label>
        <select value={form.productStatus} onChange={(e) => setField("productStatus", e.target.value)}>
          {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {form.productStatus === "Discontinué" && (
        <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>La référence reste dans la base et l'historique, mais disparaît du catalogue de prise de commande.</p>
      )}
    </>
  );
}

function AccountFormFields({ form, setForm, t, lang, role, repsList, masterRepsList }) {
  const setField = (key, val) => setForm({ ...form, [key]: val });
  const setAddr = (kind, field, val) => setForm({ ...form, [kind]: { ...form[kind], [field]: val } });

  return (
    <>
      <div className="cc-field">
        <label>{t("label_company")}</label>
        <input value={form.name} onChange={(e) => setField("name", e.target.value)} />
      </div>

      {role !== "rep" && (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="cc-field" style={{ flex: 1 }}>
            <label>Représentant affecté</label>
            <select value={form.ownerRep || ""} onChange={(e) => setField("ownerRep", e.target.value)}>
              <option value="">Aucun</option>
              {(repsList || []).map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="cc-field" style={{ flex: 1 }}>
            <label>Master Rep affecté</label>
            <select value={form.masterRep || ""} onChange={(e) => setField("masterRep", e.target.value)}>
              <option value="">Aucun</option>
              {(masterRepsList || []).map((mr) => <option key={mr.id} value={mr.name}>{mr.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>{t("label_type")}</label>
          <select value={form.type} onChange={(e) => setField("type", e.target.value)}>
            <option value="prospect">Prospect</option>
            <option value="client">Client</option>
          </select>
        </div>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>{t("label_country")}</label>
          <select value={form.country} onChange={(e) => setField("country", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="cc-field">
        <label>{t("label_typology")}</label>
        <select value={form.typology} onChange={(e) => setField("typology", e.target.value)}>
          {TYPOLOGIES.map((ty) => <option key={ty.code} value={ty.code}>{ty[lang]}</option>)}
        </select>
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 4px" }}>{t("label_billing_addr")}</p>
      <div className="cc-field"><input placeholder="Rue / numéro" value={form.billing.street} onChange={(e) => setAddr("billing", "street", e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><input placeholder="Code postal" value={form.billing.postalCode} onChange={(e) => setAddr("billing", "postalCode", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 2 }}><input placeholder="Ville" value={form.billing.city} onChange={(e) => setAddr("billing", "city", e.target.value)} /></div>
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 4px" }}>{t("label_delivery_addr")}</p>
      <div className="cc-field"><input placeholder="Rue / numéro" value={form.delivery.street} onChange={(e) => setAddr("delivery", "street", e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ flex: 1 }}><input placeholder="Code postal" value={form.delivery.postalCode} onChange={(e) => setAddr("delivery", "postalCode", e.target.value)} /></div>
        <div className="cc-field" style={{ flex: 2 }}><input placeholder="Ville" value={form.delivery.city} onChange={(e) => setAddr("delivery", "city", e.target.value)} /></div>
      </div>

      <div className="cc-field">
        <label>{t("label_contact")}</label>
        <input value={form.contact} onChange={(e) => setField("contact", e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ width: 90 }}>
          <label>Indicatif</label>
          <select value={form.phoneCode} onChange={(e) => setField("phoneCode", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.dial} value={c.dial}>{c.dial}</option>)}
          </select>
        </div>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>{t("label_phone")}</label>
          <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="cc-field" style={{ width: 90 }}>
          <label>Indicatif</label>
          <select value={form.mobileCode} onChange={(e) => setField("mobileCode", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.dial} value={c.dial}>{c.dial}</option>)}
          </select>
        </div>
        <div className="cc-field" style={{ flex: 1 }}>
          <label>{t("label_mobile")}</label>
          <input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} />
        </div>
      </div>

      <div className="cc-field">
        <label>{t("label_email")}</label>
        <input value={form.email} onChange={(e) => setField("email", e.target.value)} />
      </div>
      <div className="cc-field">
        <label>{taxIdLabel(form.country)}</label>
        <input value={form.taxId || ""} onChange={(e) => setField("taxId", e.target.value)} />
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", margin: "12px 0 4px" }}>Coordonnées bancaires (SEPA)</p>
      <div className="cc-field"><label>IBAN</label><input value={form.iban} onChange={(e) => setField("iban", e.target.value)} placeholder="FR76 ...." /></div>
      <div className="cc-field"><label>BIC / SWIFT</label><input value={form.bic || ""} onChange={(e) => setField("bic", e.target.value)} placeholder="ex : BNPAFRPP" /></div>
      <div className="cc-field">
        <label>Statut du mandat SEPA</label>
        <select value={form.sepaMandate === "Non reçu" ? "Non reçu" : "Reçu"} onChange={(e) => setField("sepaMandate", e.target.value === "Reçu" ? `Signé le ${new Date().toLocaleDateString("fr-FR")}` : "Non reçu")}>
          <option>Non reçu</option>
          <option>Reçu</option>
        </select>
      </div>
    </>
  );
}

function CatalogueView({ selectedAccount, catalog, catalogNames, activeCatalogs, toggleCatalogSelection, cart, changeQty, goToCart, changeClient, backToFiche, t }) {
  const sellable = catalog.filter((p) => p.productStatus !== "Discontinué" && activeCatalogs.includes(p.catalogName || "Sans catalogue"));
  const cats = CATEGORIES.filter((c) => sellable.some((p) => p.category === c));
  const [activeCat, setActiveCat] = useState(cats[0] || CATEGORIES[0]);
  const [productSearch, setProductSearch] = useState("");
  const q = productSearch.trim().toLowerCase();
  const filtered = sellable.filter((p) => p.category === activeCat && (!q || [p.label, p.model].join(" ").toLowerCase().includes(q)));
  const count = Object.values(cart).reduce((a, b) => a + b.qty, 0);

  return (
    <>
      <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={backToFiche}>
        <ArrowLeft size={14} /> Retour à la fiche client
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">{t("title_catalogue")}</h1>
          <p className="page-sub">Commande pour <strong>{selectedAccount.name}</strong> · <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={changeClient}>{t("btn_change_client")}</span></p>
        </div>
        {count > 0 && (
          <button className="btn primary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={goToCart}>
            <ShoppingCart size={15} /> Voir le panier ({count})
          </button>
        )}
      </div>
      {catalogNames.length > 1 && (
        <>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Catalogues actifs pour cette commande</p>
          <CatalogSelector catalogNames={catalogNames} active={activeCatalogs} onToggle={toggleCatalogSelection} />
        </>
      )}
      <div className="search-bar"><Search size={15} color="#8892A0" />
        <input placeholder="Rechercher un produit (libellé, modèle)..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
      </div>
      <div className="cat-tabs">
        {cats.map((c) => (
          <button key={c} className={`cat-tab ${activeCat === c ? "active" : ""}`} onClick={() => setActiveCat(c)}>
            {c === "Display" && <Gift size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}{c}
          </button>
        ))}
      </div>
      {cats.length === 0 && <p style={{ color: "var(--ink-soft)" }}>Aucun produit disponible pour les catalogues sélectionnés.</p>}
      <div className="product-grid">
        {filtered.map((p) => {
          const price = priceFor(p, selectedAccount.country);
          return (
            <div className="product-card" key={p.id}>
              <img src={p.photoUrl || photoFor(p.label)} alt={p.label} onError={(e) => { e.currentTarget.src = photoFor(p.label); }} />
              <div className="product-body">
                <div className="product-ref">{p.ref} {p.productStatus === "Nouveau" && <span className="offert-badge" style={{ marginLeft: 4 }}>Nouveau</span>}</div>
                <div className="product-name">{p.label}</div>
                <div className="product-price">{price ? money(price) : <span style={{ color: "var(--ink-soft)" }}>Prix à définir</span>}</div>
                <div className="product-stock" style={{ color: p.stockStatus === "En stock" ? "var(--teal)" : p.stockStatus === "Réassort prévu" ? "var(--gold)" : "var(--danger)" }}>
                  {p.stockStatus === "En stock" ? "En stock" : p.stockStatus === "Réassort prévu"
                    ? `Réassort ${p.restockDate ? "prévu le " + p.restockDate : "— date non connue"} — commande possible en reliquat`
                    : `Rupture — ${p.restockDate ? "retour prévu le " + p.restockDate : "date de retour non connue"}`}
                </div>
                <div className="qty-row">
                  <button onClick={() => changeQty(p.id, -1)} disabled={p.stockStatus === "Rupture"}><Minus size={13} /></button>
                  <span className="qty">{cart[p.id]?.qty || 0}</span>
                  <button onClick={() => changeQty(p.id, 1)} disabled={p.stockStatus === "Rupture"}><Plus size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {activeCat === "Display" && (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 10 }}>
          <Gift size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Les displays peuvent être marqués "{t("offert")}" au moment du récapitulatif.
        </p>
      )}
    </>
  );
}
