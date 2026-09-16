import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  ClipboardCheck,
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Image,
  Award,
  CalendarDays,
  UserCog,
  Settings2,
  FileUp,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { useI18n } from "./i18n/I18nContext.jsx";
import { useAgendaSummary } from "./hooks/useAgendaSummary.js";
import { useOrdersActionSummary } from "./hooks/useOrdersActionSummary.js";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import FrontDesk from "./pages/FrontDesk.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Equipe from "./pages/Equipe.jsx";
import RepProfile from "./pages/RepProfile.jsx";
import ClientsList from "./pages/ClientsList.jsx";
import AccountDetail from "./pages/AccountDetail.jsx";
import Agenda from "./pages/Agenda.jsx";
import Catalogue from "./pages/Catalogue.jsx";
import NewOrder from "./pages/NewOrder.jsx";
import OrdersList from "./pages/OrdersList.jsx";
import TeamManagement from "./pages/TeamManagement.jsx";
import UsersAdmin from "./pages/UsersAdmin.jsx";
import DirecteurDashboard from "./pages/DirecteurDashboard.jsx";
import Data from "./pages/Data.jsx";
import BusinessRules from "./pages/BusinessRules.jsx";
import CatalogueAdmin from "./pages/CatalogueAdmin.jsx";
import CatalogueConsult from "./pages/CatalogueConsult.jsx";
import AccountsImportAdmin from "./pages/AccountsImportAdmin.jsx";
import SavQueue from "./pages/SavQueue.jsx";
import MasterRepDashboard from "./pages/MasterRepDashboard.jsx";
import RepData from "./pages/RepData.jsx";
import AppShell from "./components/AppShell.jsx";

// Écran neutre pour les rôles sans écran construit pour l'instant
// (Administrateur) — même contenu qu'avant, simplement routé plutôt qu'en
// dur dans App.jsx.
function ComingSoon() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roleLabel = t(`role.${user.role}`);
  return (
    <>
      <h1 className="page-title">{t("comingSoon.title")}</h1>
      <p className="page-sub">{t("comingSoon.body", { role: roleLabel })}</p>
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  // Appelé inconditionnellement (règle des hooks) avant tout retour anticipé
  // ci-dessous — `enabled` désactive juste les requêtes tant qu'on n'est pas
  // sûr que le rôle y a accès (cf. commentaire du hook). Sert au badge de
  // l'onglet "Agenda" de la nav Représentant/Master Rep, plus bas — les deux
  // rôles ont accès à GET /api/dashboard/rdv et GET /api/tasks (cf. DATA_ROLES
  // dans dashboard.js et le rôle MASTER_REP dans tasks.js).
  const agenda = useAgendaSummary({ enabled: user?.role === "REPRESENTANT" || user?.role === "MASTER_REP" });
  // Badge "commandes à traiter" (statut ENVOYEE_FRONT_DESK) sur l'onglet
  // Commandes du Front Desk et du Directeur — cf. PDF Front Desk, exigence
  // "voir en un coup d'œil ce qu'il reste à traiter".
  const ordersAction = useOrdersActionSummary({
    enabled: user?.role === "FRONT_DESK" || user?.role === "DIRECTEUR",
  });

  if (loading) return null;
  if (!user) return <Login />;

  // Changement de mot de passe forcé (compte créé par un administrateur, ou
  // après une réinitialisation) : bloque toute l'app tant que ce n'est pas
  // fait — cohérent avec le backend qui refuse déjà toute autre route dans ce
  // cas (requireAuth), ceci n'est qu'un reflet côté interface.
  if (user.mustChangePassword) {
    return <ChangePassword forced />;
  }

  const isFrontDesk = user.role === "FRONT_DESK";
  const isDirecteur = user.role === "DIRECTEUR";
  const canSeeFrontDesk = isFrontDesk || isDirecteur;
  const isRepresentant = user.role === "REPRESENTANT";
  const isMasterRep = user.role === "MASTER_REP";
  const isAdministrateur = user.role === "ADMINISTRATEUR";

  // Nav réelle : Front desk (1 item), Directeur (portail complet — vision
  // globale sur toute l'entreprise, section 3 du handoff), Représentant
  // (portail complet, structure fidèle à la maquette —
  // docs/prototype-crm-commercial.jsx, repNav) et Master Rep (portail équipe,
  // structure fidèle à la maquette — masterRepNav : "Mon équipe" comme écran
  // d'accueil plutôt qu'un tableau de bord séparé, "Clients & prospects" et
  // "Agenda équipe" réutilisent directement les mêmes pages que le
  // Représentant — déjà scopées équipe/soi-même côté serveur, cf. lib/scope.js
  // — et "Commandes" est ajouté ici en plus de la maquette d'origine :
  // NewOrder.jsx redirige vers /commandes après l'envoi d'une commande, cette
  // route doit donc exister et rester atteignable depuis la nav, pas
  // seulement accessible en revenant en arrière). Master Rep n'a pas (encore)
  // de Catalogue ni de Data séparés, cohérent avec le Représentant : /data
  // lui-même n'a encore qu'un écran ComingSoon à ce stade pour ces deux
  // rôles-là (le Directeur, lui, a un vrai écran Data — cf. plus bas).
  // Administrateur (portail catalogue + imports, cf. plus bas) est le
  // dernier rôle à avoir eu son écran construit.
  //
  // Directeur : "/orders" (front desk) et "/clients" (CRM) réutilisent
  // directement FrontDesk.jsx et ClientsList.jsx/AccountDetail.jsx — déjà
  // conçus pour s'adapter au rôle DIRECTEUR (vision globale côté serveur,
  // section réaffectation ajoutée à la fiche compte). "Équipe" réutilise le
  // chemin /equipe mais avec TeamManagement.jsx (gestion complète) plutôt
  // qu'Equipe.jsx (suivi lecture seule du Master Rep) — jamais les deux en
  // même temps, les rôles sont mutuellement exclusifs. Pas d'écran "Carte" :
  // décision documentée dans le README (données lat/lng inexistantes dans le
  // schéma réel), le filtrage qu'elle aurait offert est repris dans le CRM.
  let navItems = [];
  let homePath = "/home";
  if (isDirecteur) {
    navItems = [
      { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
      { to: "/clients", label: t("nav.clients"), icon: Users },
      { to: "/equipe", label: t("nav.equipeAdmin"), icon: UserCheck },
      {
        to: "/orders",
        label: t("nav.frontDesk"),
        icon: ClipboardCheck,
        badge: ordersAction.badgeCount > 0 ? ordersAction.badgeCount : undefined,
      },
      { to: "/sav", label: t("nav.sav"), icon: LifeBuoy },
      { to: "/data", label: t("nav.data"), icon: Award },
      { to: "/config", label: t("nav.config"), icon: Settings2 },
      { to: "/utilisateurs", label: t("nav.utilisateurs"), icon: UserCog },
      { to: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    ];
    homePath = "/dashboard";
  } else if (isFrontDesk) {
    // PDF Front Desk section "Périmètre attendu" : Commandes + Clients &
    // prospects (accès global) + SAV — pas seulement la file de commandes
    // qui était, jusqu'ici, le seul écran routé pour ce rôle.
    navItems = [
      {
        to: "/orders",
        label: t("nav.orders"),
        icon: ClipboardCheck,
        badge: ordersAction.badgeCount > 0 ? ordersAction.badgeCount : undefined,
      },
      { to: "/clients", label: t("nav.clients"), icon: Users },
      { to: "/sav", label: t("nav.sav"), icon: LifeBuoy },
    ];
    homePath = "/orders";
  } else if (isRepresentant) {
    navItems = [
      { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
      { to: "/clients", label: t("nav.clients"), icon: Users },
      { to: "/commandes", label: t("nav.commandes"), icon: ClipboardCheck },
      { to: "/catalogue", label: t("nav.catalogue"), icon: Package },
      { to: "/data", label: t("nav.data"), icon: Award },
      {
        to: "/agenda",
        label: t("nav.agenda"),
        icon: CalendarDays,
        badge: agenda.badgeCount > 0 ? agenda.badgeCount : undefined,
      },
    ];
    homePath = "/dashboard";
  } else if (isMasterRep) {
    // Dashboard sectoriel ajouté en écran d'accueil (n'existait pas avant —
    // cf. PDF Master Rep section 1 : KPI secteur + performance équipe + carte
    // & tournées). "Mon équipe" (Equipe.jsx) reste accessible séparément pour
    // le suivi individuel en lecture seule des objectifs par représentant.
    navItems = [
      { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
      { to: "/equipe", label: t("nav.equipe"), icon: UserCheck },
      { to: "/clients", label: t("nav.clients"), icon: Users },
      { to: "/commandes", label: t("nav.commandes"), icon: ClipboardCheck },
      {
        to: "/agenda",
        label: t("nav.agenda"),
        icon: CalendarDays,
        badge: agenda.badgeCount > 0 ? agenda.badgeCount : undefined,
      },
    ];
    homePath = "/dashboard";
  } else if (isAdministrateur) {
    // Catalogue produits (gestion + import en masse) et import fiches client —
    // les deux responsabilités documentées pour ce rôle (section 3 du
    // handoff), plus un accès à la fiche client elle-même (lecture/écriture
    // complète hors commandes/pipeline, cf. docs/cahier-des-charges-import-
    // fiches-client.md section 2), réutilisant ClientsList.jsx/AccountDetail.jsx
    // déjà scopés côté serveur comme pour les autres rôles.
    navItems = [
      { to: "/catalogue", label: t("nav.catalogueAdmin"), icon: Package },
      { to: "/catalogue-produits", label: t("nav.catalogueConsult"), icon: Image },
      { to: "/import-clients", label: t("nav.importClients"), icon: FileUp },
      { to: "/clients", label: t("nav.clients"), icon: Users },
    ];
    homePath = "/catalogue";
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell navItems={navItems} />}>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          {canSeeFrontDesk && <Route path="/orders" element={<FrontDesk />} />}
          {(isFrontDesk || isDirecteur) && <Route path="/sav" element={<SavQueue />} />}
          {isFrontDesk && (
            <>
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<AccountDetail />} />
            </>
          )}
          {isDirecteur && (
            <>
              <Route path="/dashboard" element={<DirecteurDashboard />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<AccountDetail />} />
              <Route path="/equipe" element={<TeamManagement />} />
              <Route path="/data" element={<Data />} />
              <Route path="/config" element={<BusinessRules />} />
              <Route path="/utilisateurs" element={<UsersAdmin />} />
              <Route path="/agenda" element={<Agenda />} />
            </>
          )}
          {isRepresentant && (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<AccountDetail />} />
              <Route path="/clients/:id/commande" element={<NewOrder />} />
              <Route path="/commandes" element={<OrdersList />} />
              <Route path="/catalogue" element={<Catalogue />} />
              <Route path="/data" element={<RepData />} />
              <Route path="/agenda" element={<Agenda />} />
            </>
          )}
          {isMasterRep && (
            <>
              <Route path="/dashboard" element={<MasterRepDashboard />} />
              <Route path="/equipe" element={<Equipe />} />
              <Route path="/equipe/:repId" element={<RepProfile />} />
              <Route path="/clients" element={<ClientsList />} />
              {/* Pas de /clients/:id/commande : la création de commande est
                  réservée au Représentant (règle non négociable des PDF de
                  cadrage, 2026-09-15 — "Le Master Rep ne doit pas avoir de
                  fonction de création de commande"). La fiche compte reste
                  accessible en lecture/actions autorisées, /commandes reste
                  une vue de LECTURE du secteur (cf. orders.js ORDER_ROLES). */}
              <Route path="/clients/:id" element={<AccountDetail />} />
              <Route path="/commandes" element={<OrdersList />} />
              <Route path="/agenda" element={<Agenda />} />
            </>
          )}
          {isAdministrateur && (
            <>
              <Route path="/catalogue" element={<CatalogueAdmin />} />
              <Route path="/catalogue-produits" element={<CatalogueConsult />} />
              <Route path="/import-clients" element={<AccountsImportAdmin />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<AccountDetail />} />
            </>
          )}
          {!canSeeFrontDesk && !isRepresentant && !isMasterRep && !isDirecteur && !isAdministrateur && (
            <Route path="/home" element={<ComingSoon />} />
          )}
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
