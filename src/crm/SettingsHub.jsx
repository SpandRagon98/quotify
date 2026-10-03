import {
  Layers,
  Users,
  Plug,
  Sparkles,
  Shield,
  Database,
  BarChart3,
} from "lucide-react";
import { useCRM } from "./context";
import Onboarding from "./Onboarding";
import PulseSettings from "./PulseSettings";
const TOOLS = [
  [
    "Templates",
    "Build and reuse your quotation and document templates.",
    "presets",
    Layers,
  ],
  [
    "Products & services",
    "Your existing quotation database and saved records.",
    "database",
    Database,
  ],
  ["Team", "People, ownership and shared workspace access.", "users", Users],
  ["Integrations", "Website enquiries, Telegram and imports.", "inbox", Plug],
  [
    "Automation",
    "Quotation rules, email replies and follow-ups.",
    "workflows",
    Sparkles,
  ],
  [
    "Roles & permissions",
    "Choose what each person can view and change.",
    "permissions",
    Shield,
  ],
  [
    "Sales overview",
    "The original quotation performance dashboard.",
    "dashboard",
    BarChart3,
  ],
];
export default function SettingsHub({ go, allowedTabs, children }) {
  const env = useCRM();
  return (
    <div className="settings-hub">
      <div className="settings-tools">
        {TOOLS.filter(([, , key]) => allowedTabs.includes(key)).map(
          ([name, description, key, Icon]) => (
            <button key={key} onClick={() => go(key)}>
              <Icon size={21} />
              <span>
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
            </button>
          ),
        )}
      </div>
      {["owner", "admin", "editor"].includes(env.user.role) && (
        <>
          <Onboarding env={env} go={go} />
          <PulseSettings env={env} />
        </>
      )}
      {children}
    </div>
  );
}
