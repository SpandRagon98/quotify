import { useState } from "react";
import {
  HelpCircle,
  Layers,
  ClipboardList,
  FileText,
  Eye,
  Mail,
  PenLine,
  Activity,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import Modal from "./Modal";

const STEPS = [
  {
    icon: Layers,
    title: "1 · Presets",
    text: "Start in the Presets tab: create a quotation preset with your custom fields (text, numbers, dates, calculated totals, subfields). Link a Google Sheet — and optionally a Google Doc template — to each preset.",
  },
  {
    icon: ClipboardList,
    title: "2 · Data entry",
    text: "Open a preset's form and fill in the quotation details. Calculated fields update live, and validation catches missing or invalid values before you continue.",
  },
  {
    icon: FileText,
    title: "3 · Document generation",
    text: "On the Review screen choose the document type: Native PDF (Qyrova's built-in design) or Google Doc (your linked template, placeholders filled automatically). The row is saved to the preset's Sheet either way.",
  },
  {
    icon: Eye,
    title: "4 · Preview",
    text: "Check the document before sending: add your logo and banner, edit the description, hide fields, and append extra content like terms or notes. Doc View lets you fine-tune any saved quotation later.",
  },
  {
    icon: Mail,
    title: "5 · Email sending",
    text: "From the Email tab, compose and send a clean professional email. It carries only your message and a secure document link — the recipient opens it to view and respond. No attachments needed.",
  },
  {
    icon: PenLine,
    title: "6 · Approval & signature",
    text: "The recipient opens the link, sees the branded quotation, and can download the PDF. To accept they type their full name as a signature; they can also decline or request changes with a note.",
  },
  {
    icon: Activity,
    title: "7 · Tracking status",
    text: "Watch the lifecycle in the Database and Email tabs: Sent → Viewed → Accepted / Declined / Changes — with view counts, signer name, and expiry. The notification bell pings you the moment a status changes.",
  },
];

/** Tiny floating help button (bottom-right) that opens a 7-step walkthrough. */
export default function HelpWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const launch = () => {
    setStep(0);
    setOpen(true);
  };

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <>
      <button
        className="help-fab"
        onClick={launch}
        title="How Qyrova works"
        aria-label="Open the Qyrova walkthrough"
      >
        <HelpCircle size={19} />
      </button>

      <Modal
        open={open}
        title="How Qyrova works"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              className="btn btn-soft"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (last ? setOpen(false) : setStep((v) => v + 1))}
            >
              {last ? (
                <>
                  <Check size={16} /> Done
                </>
              ) : (
                <>
                  Next <ChevronRight size={16} />
                </>
              )}
            </button>
          </>
        }
      >
        <div className="walkthrough">
          <div className="walkthrough-icon">
            <Icon size={26} />
          </div>
          <h3 className="walkthrough-title">{s.title}</h3>
          <p className="walkthrough-text">{s.text}</p>
          <div className="walkthrough-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`walkthrough-dot ${i === step ? "is-active" : ""}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
