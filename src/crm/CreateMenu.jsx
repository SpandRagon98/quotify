import { useState } from "react";
import {
  Plus,
  UserRound,
  Building2,
  FileText,
  CheckSquare,
  StickyNote,
  Sparkles,
} from "lucide-react";
import { useCRM } from "./context";
import RecordForm from "./RecordForm";
import CustomerCreate from "./CustomerCreate";
import QuickCapture from "./QuickCapture";
const CREATE_ACTIONS = [
  ["Customer", "leads", UserRound],
  ["Company", "accounts", Building2],
  ["Enquiry", "leads", UserRound],
  ["Deal", "opportunities", Plus],
  ["Quotation", "quotations", FileText],
  ["Invoice", "quotations", FileText],
  ["Task", "activities", CheckSquare],
  ["Note", "activities", StickyNote],
];
export default function CreateMenu({ go, intent, clearIntent }) {
  const env = useCRM();
  const [menu, setMenu] = useState(false);
  const [kind, setKind] = useState(null);
  const current = intent || kind;
  const [defaultDue] = useState(() =>
    new Date(Date.now() + 3600000).toISOString(),
  );
  const close = () => {
    setKind(null);
    clearIntent?.();
  };
  const create = (next) => {
    setMenu(false);
    if (["Quotation", "Invoice", "Proposal"].includes(next)) {
      go("quote_wizard", { documentKind: next });
      close();
    } else setKind(next);
  };
  const entity = {
    Company: "accounts",
    Enquiry: "leads",
    Deal: "opportunities",
    Task: "activities",
    Note: "activities",
  }[current];
  return (
    <div className="global-create">
      <button
        className="btn btn-primary"
        aria-expanded={menu}
        aria-haspopup="menu"
        onClick={() => setMenu((old) => !old)}
      >
        <Plus size={17} />
        Create
      </button>
      {menu && (
        <>
          <button
            className="create-menu-dismiss"
            aria-label="Close create menu"
            onClick={() => setMenu(false)}
          />
          <div className="create-popover" role="menu">
            {CREATE_ACTIONS.filter(
              ([, permission]) => env.access[permission]?.create,
            ).map(([label, , Icon]) => (
              <button role="menuitem" key={label} onClick={() => create(label)}>
                <Icon size={16} />
                {label === "Note" ? "Add note" : `New ${label.toLowerCase()}`}
              </button>
            ))}
            {env.access.leads?.create && (
              <button role="menuitem" onClick={() => create("Capture")}>
                <Sparkles size={16} />
                Quick capture
              </button>
            )}
          </div>
        </>
      )}
      {current === "Capture" && env.access.leads?.create && (
        <QuickCapture env={env} go={go} onClose={close} />
      )}
      {current === "Customer" && env.access.leads?.create && (
        <CustomerCreate
          env={env}
          onClose={close}
          onSaved={(result) => {
            close();
            go("crm_record", { entity: "accounts", id: result.account_id });
          }}
        />
      )}
      {entity && env.access[entity]?.create && (
        <RecordForm
          key={current}
          entity={entity}
          env={env}
          record={
            current === "Task"
              ? { due_at: defaultDue }
              : current === "Note"
                ? { activity_type: "Note", status: "Completed" }
                : current === "Company"
                  ? { account_type: "Company" }
                  : {}
          }
          onClose={close}
          onSaved={(row) => {
            close();
            go("crm_record", { entity, id: row.id });
          }}
        />
      )}
    </div>
  );
}
