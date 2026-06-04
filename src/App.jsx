import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/Layout/AppLayout";
import Dashboard from "./components/Dashboard/Dashboard";
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
import { usePresets } from "./hooks/usePresets";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import { allowedTabs, canAccessTab, canDeleteRecords, defaultTab } from "./auth/roles";

/** Maps each view to the sidebar tab that governs access to it. */
const VIEW_TAB = {
  dashboard: "dashboard",
  presets: "presets",
  editor: "presets",
  form: "presets",
  preview: "presets",
  database: "database",
  docview: "docview",
  email: "email",
  users: "users",
  settings: "settings",
};

export default function App() {
  const auth = useAuth();
  const { settings, setMode, setAccent } = useSettings();
  const { presets, savePreset, deletePreset, getPreset } = usePresets();
  const [view, setView] = useState({ name: "dashboard" });

  const go = (name, extra = {}) => setView({ name, ...extra });
  const handleNav = (key) => go(key);

  // --- Auth gates (all hooks above run unconditionally) ---
  if (!auth.session) return <AuthScreen onLogin={auth.login} onSignup={auth.signup} />;
  if (!auth.role) return <NoAccessScreen email={auth.session} onLogout={auth.logout} />;

  const role = auth.role;
  const tabs = allowedTabs(role);

  // Fall back to the role's default tab if the current view isn't permitted.
  const requiredTab = VIEW_TAB[view.name] || "dashboard";
  const screenView = canAccessTab(role, requiredTab) ? view : { name: defaultTab(role) };
  const activeNav = VIEW_TAB[screenView.name] || defaultTab(role);

  const renderScreen = () => {
    switch (screenView.name) {
      case "database":
        return (
          <DatabasePage
            presets={presets}
            initialPresetId={screenView.presetId}
            canDelete={canDeleteRecords(role)}
            onEditPreset={(id) => go("editor", { presetId: id })}
            onLoadQuotation={({ presetId, values, quotationId, createdAt }) =>
              go("form", {
                presetId,
                initialValues: values,
                editingQuotationId: quotationId,
                editingCreatedAt: createdAt,
              })
            }
          />
        );

      case "docview":
        return (
          <DocViewPage
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
            onSelectPreset={(id) => go("form", { presetId: id })}
            onPreview={(values) =>
              go("preview", {
                presetId: preset.id,
                values,
                editingQuotationId: screenView.editingQuotationId,
                editingCreatedAt: screenView.editingCreatedAt,
              })
            }
            onEdit={(id) => go("editor", { presetId: id })}
            onBack={() => go(screenView.editingQuotationId ? "database" : "dashboard")}
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
            onBack={() =>
              go("form", {
                presetId: preset.id,
                initialValues: screenView.values,
                editingQuotationId: screenView.editingQuotationId,
                editingCreatedAt: screenView.editingCreatedAt,
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
            onCreatePreset={() => go("editor", { presetId: null })}
            onOpenForm={(id) => go("form", { presetId: id })}
            onManagePresets={() => go("presets")}
          />
        );
    }
  };

  return (
    <AppLayout
      active={activeNav}
      onNavigate={handleNav}
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
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
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
