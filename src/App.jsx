import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/Layout/WorkspaceLayout";
import LoadingScreen from "./components/common/LoadingScreen";
import Dashboard from "./components/Dashboard/Overview";
import PresetManager from "./components/PresetManager/PresetManager";
import PresetEditor from "./components/PresetManager/PresetEditor";
import DynamicForm from "./components/DynamicForm/DynamicForm";
import QuotationPreview from "./components/QuotationPreview/QuotationPreview";
import DatabasePage from "./components/Database/DatabasePage";
import DocViewPage from "./components/DocView/DocViewPage";
import EmailPage from "./components/Email/EmailPage";
import UsersPage from "./components/Users/UsersPage";
import SettingsPage from "./components/Settings/SettingsPage";
import AuthScreen from "./components/Auth/AuthScreen";
import NoAccessScreen from "./components/Auth/NoAccessScreen";
import NotificationsProvider from "./notifications/NotificationsProvider";
import { usePresets } from "./hooks/usePresets";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import {
  allowedTabs,
  canAccessTab,
  canDeleteRecords,
  defaultTab,
} from "./auth/roles";
import CRMProvider from "./crm/CRMProvider";
const CRMPage = lazy(() => import("./crm/CRMPage"));
import QuotationPrefill from "./crm/QuotationPrefill";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import "./crm/crm.css";

/** Maps each view to the sidebar tab that governs access to it. */
const VIEW_TAB = {
  dashboard: "dashboard",
  presets: "presets",
  editor: "presets",
  form: "database",
  preview: "database",
  database: "database",
  docview: "docview",
  email: "email",
  users: "users",
  settings: "settings",
  crm_dashboard: "crm_dashboard",
  leads: "leads",
  accounts: "accounts",
  contacts: "contacts",
  opportunities: "opportunities",
  activities: "activities",
  inbox: "inbox",
  workflows: "workflows",
  reports: "reports",
  permissions: "permissions",
};

export default function App() {
  const auth = useAuth();
  const { settings, setMode, setAccent } = useSettings();
  const { presets, savePreset, deletePreset, getPreset } = usePresets();
  const [view, setView] = useState({
    name: isSupabaseConfigured ? "crm_dashboard" : "dashboard",
  });
  const [quoteContext, setQuoteContext] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1600);
    return () => clearTimeout(t);
  }, []);

  const go = (name, extra = {}) => setView({ name, ...extra });
  const handleNav = (key) => go(key);

  // --- Splash, then auth gates (all hooks above run unconditionally) ---
  // Wait for the (cloud) session to restore before deciding which screen to show.
  if (booting || !auth.ready) return <LoadingScreen />;
  if (auth.startupError)
    return (
      <div className="crash-screen">
        <div className="crash-card" role="alert">
          <h2>Couldn't open your workspace</h2>
          <p>{auth.startupError}</p>
          <p>
            Your saved data has not been deleted. Retry when your connection is
            available.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry Qyrova
          </button>
        </div>
      </div>
    );
  if (!auth.session)
    return <AuthScreen onLogin={auth.login} onSignup={auth.signup} />;
  if (!auth.role)
    return <NoAccessScreen email={auth.session} onLogout={auth.logout} />;

  const role = auth.role;
  const tabs = allowedTabs(role);

  // Fall back to the role's default tab if the current view isn't permitted.
  const requiredTab =
    view.name === "crm_record"
      ? view.entity === "quote_links"
        ? "database"
        : view.entity
      : VIEW_TAB[view.name] || "dashboard";
  const canWriteQuote = !["viewer", "doc_viewer"].includes(role);
  const screenView =
    canAccessTab(role, requiredTab) &&
    (!["form", "preview"].includes(view.name) || canWriteQuote)
      ? view
      : { name: defaultTab(role) };
  const activeNav =
    screenView.name === "crm_record"
      ? screenView.entity === "quote_links"
        ? "database"
        : screenView.entity
      : VIEW_TAB[screenView.name] || defaultTab(role);

  const renderScreen = () => {
    switch (screenView.name) {
      case "crm_dashboard":
      case "leads":
      case "accounts":
      case "contacts":
      case "opportunities":
      case "activities":
      case "inbox":
      case "crm_record":
      case "workflows":
      case "reports":
      case "permissions":
        return (
          <CRMPage
            view={screenView}
            go={go}
            presets={presets}
            onCreateQuote={setQuoteContext}
          />
        );
      case "database":
        return (
          <DatabasePage
            presets={presets}
            initialPresetId={screenView.presetId}
            initialQuery={screenView.initialQuery}
            canDelete={canDeleteRecords(role)}
            canExport={!["viewer", "doc_viewer"].includes(role)}
            onEditPreset={(id) => go("editor", { presetId: id })}
            onLoadQuotation={
              canWriteQuote
                ? ({ presetId, values, quotationId, createdAt }) =>
                    go("form", {
                      presetId,
                      initialValues: values,
                      editingQuotationId: quotationId,
                      editingCreatedAt: createdAt,
                    })
                : undefined
            }
          />
        );

      case "docview":
        return (
          <DocViewPage
            canEdit={["owner", "admin", "editor"].includes(role)}
            presets={presets}
            initialPresetId={screenView.presetId}
            onEditPreset={(id) => go("editor", { presetId: id })}
          />
        );

      case "email":
        return (
          <EmailPage
            presets={presets}
            initialPresetId={screenView.presetId}
            onEditPreset={(id) => go("editor", { presetId: id })}
          />
        );

      case "users":
        if (isSupabaseConfigured)
          return <CRMPage view={screenView} go={go} presets={presets} />;
        return (
          <UsersPage
            userList={auth.userList}
            currentEmail={auth.currentUser.email}
            onUpsert={auth.upsertUser}
            onRemove={auth.removeUser}
          />
        );

      case "settings":
        return (
          <SettingsPage
            settings={settings}
            setMode={setMode}
            setAccent={setAccent}
            user={auth.currentUser}
            canEditMeta={["owner", "admin", "editor"].includes(role)}
            onUpdateProfile={auth.updateProfile}
          />
        );

      case "presets":
        return (
          <PresetManager
            presets={presets}
            onCreate={() => go("editor", { presetId: null })}
            onEdit={(id) => go("editor", { presetId: id })}
            onDelete={deletePreset}
            onOpenForm={(id) => go("form", { presetId: id })}
          />
        );

      case "editor":
        return (
          <PresetEditor
            preset={screenView.presetId ? getPreset(screenView.presetId) : null}
            onSave={(preset) => {
              savePreset(preset);
              go("presets");
            }}
            onCancel={() => go("presets")}
          />
        );

      case "form": {
        const preset = getPreset(screenView.presetId);
        if (!preset) return fallback(() => go("presets"));
        return (
          <DynamicForm
            preset={preset}
            presets={presets}
            initialValues={screenView.initialValues}
            editingQuotationId={screenView.editingQuotationId}
            onSelectPreset={(id) =>
              screenView.crmContext
                ? setQuoteContext(screenView.crmContext)
                : go("form", { presetId: id })
            }
            onPreview={(values) =>
              go("preview", {
                presetId: preset.id,
                values,
                editingQuotationId: screenView.editingQuotationId,
                editingCreatedAt: screenView.editingCreatedAt,
                crmContext: screenView.crmContext,
              })
            }
            onEdit={(id) => go("editor", { presetId: id })}
            onBack={() =>
              screenView.crmContext
                ? go("crm_record", {
                    entity: "accounts",
                    id: screenView.crmContext.account_id,
                  })
                : go(screenView.editingQuotationId ? "database" : "dashboard")
            }
            onCancelEdit={() => go("form", { presetId: preset.id })}
          />
        );
      }

      case "preview": {
        const preset = getPreset(screenView.presetId);
        if (!preset) return fallback(() => go("presets"));
        return (
          <QuotationPreview
            preset={preset}
            values={screenView.values}
            editingQuotationId={screenView.editingQuotationId}
            editingCreatedAt={screenView.editingCreatedAt}
            crmContext={screenView.crmContext}
            user={auth.currentUser}
            onBack={() =>
              go("form", {
                presetId: preset.id,
                initialValues: screenView.values,
                editingQuotationId: screenView.editingQuotationId,
                editingCreatedAt: screenView.editingCreatedAt,
                crmContext: screenView.crmContext,
              })
            }
            onUpdated={() => go("database", { presetId: preset.id })}
          />
        );
      }

      case "dashboard":
      default:
        return (
          <Dashboard
            presets={presets}
            userName={auth.currentUser.name || "there"}
            onOpenDatabase={(presetId) => go("database", { presetId })}
            onCreatePreset={() => go("editor", { presetId: null })}
            onOpenForm={(id) => go("form", { presetId: id })}
            onManagePresets={() => go("presets")}
          />
        );
    }
  };

  return (
    <CRMProvider
      key={`${auth.currentUser.id}:${auth.currentUser.orgId}`}
      user={auth.currentUser}
    >
      <NotificationsProvider user={auth.currentUser}>
        <AppLayout
          active={activeNav}
          onNavigate={handleNav}
          onOpenRecord={(entity, id) => go("crm_record", { entity, id })}
          allowedTabs={tabs}
          user={auth.currentUser}
          onLogout={auth.logout}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${screenView.name}:${screenView.presetId || ""}:${screenView.editingQuotationId || "new"}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <Suspense
                fallback={
                  <div className="screen empty-inline">Opening workspace…</div>
                }
              >
                {renderScreen()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </AppLayout>
        {quoteContext && (
          <QuotationPrefill
            context={quoteContext}
            presets={presets}
            onClose={() => setQuoteContext(null)}
            onContinue={(next) => {
              setQuoteContext(null);
              go("form", next);
            }}
          />
        )}
      </NotificationsProvider>
    </CRMProvider>
  );
}

function fallback(onBack) {
  return (
    <div className="screen">
      <div className="empty-state">
        <p>That preset no longer exists.</p>
        <button className="btn btn-primary" onClick={onBack}>
          Back to presets
        </button>
      </div>
    </div>
  );
}
