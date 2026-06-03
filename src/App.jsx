import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/Layout/AppLayout";
import Dashboard from "./components/Dashboard/Dashboard";
import PresetManager from "./components/PresetManager/PresetManager";
import PresetEditor from "./components/PresetManager/PresetEditor";
import DynamicForm from "./components/DynamicForm/DynamicForm";
import QuotationPreview from "./components/QuotationPreview/QuotationPreview";
import DatabasePage from "./components/Database/DatabasePage";
import { usePresets } from "./hooks/usePresets";

/**
 * Lightweight view state machine (no router dependency).
 * view.name ∈ dashboard | presets | editor | form | preview | database
 */
export default function App() {
  const { presets, savePreset, deletePreset, getPreset } = usePresets();
  const [view, setView] = useState({ name: "dashboard" });

  const go = (name, extra = {}) => setView({ name, ...extra });

  // Top-level sidebar navigation.
  const handleNav = (key) => go(key);

  const activeNav =
    view.name === "database"
      ? "database"
      : view.name === "dashboard"
      ? "dashboard"
      : "presets";

  const renderScreen = () => {
    switch (view.name) {
      case "database":
        return (
          <DatabasePage
            presets={presets}
            initialPresetId={view.presetId}
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
            preset={view.presetId ? getPreset(view.presetId) : null}
            onSave={(preset) => {
              savePreset(preset);
              go("presets");
            }}
            onCancel={() => go("presets")}
          />
        );

      case "form": {
        const preset = getPreset(view.presetId);
        if (!preset) return fallback(() => go("presets"));
        return (
          <DynamicForm
            preset={preset}
            presets={presets}
            initialValues={view.initialValues}
            editingQuotationId={view.editingQuotationId}
            onSelectPreset={(id) => go("form", { presetId: id })}
            onPreview={(values) =>
              go("preview", {
                presetId: preset.id,
                values,
                editingQuotationId: view.editingQuotationId,
                editingCreatedAt: view.editingCreatedAt,
              })
            }
            onEdit={(id) => go("editor", { presetId: id })}
            onBack={() => go(view.editingQuotationId ? "database" : "dashboard")}
            onCancelEdit={() => go("form", { presetId: preset.id })}
          />
        );
      }

      case "preview": {
        const preset = getPreset(view.presetId);
        if (!preset) return fallback(() => go("presets"));
        return (
          <QuotationPreview
            preset={preset}
            values={view.values}
            editingQuotationId={view.editingQuotationId}
            editingCreatedAt={view.editingCreatedAt}
            onBack={() =>
              go("form", {
                presetId: preset.id,
                // Preserve entered values + edit context when going back.
                initialValues: view.values,
                editingQuotationId: view.editingQuotationId,
                editingCreatedAt: view.editingCreatedAt,
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
    <AppLayout active={activeNav} onNavigate={handleNav}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${view.name}:${view.presetId || ""}:${view.editingQuotationId || "new"}`}
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
