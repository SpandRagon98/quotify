import { useMemo, useState } from "react";
import "./App.css";
import QuotationPage from "./pages/QuotationPage";
import SearchPage from "./pages/SearchPage";
import { initialForm } from "./data/constants";
import { calculateQuote } from "./utils/calculations";
import { buildPayload, saveQuotation, generatePdf } from "./utils/api";

export default function App() {
  const [page, setPage] = useState("quotation");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const calculations = useMemo(() => calculateQuote(form), [form]);
  const payload = useMemo(() => buildPayload(form, calculations), [form, calculations]);

  const resetForm = () => {
    setForm({
      ...initialForm,
      quotationNumber: "",
      quotationDate: new Date().toISOString().split("T")[0],
    });
    setStatus("Form reset.");
  };

  const saveToGoogleSheet = async () => {
    if (!form.clientName || !form.projectLocation) {
      setStatus("Please fill client name and address before saving.");
      return;
    }
    try {
      setSaving(true);
      setStatus("Saving quotation details and generating quotation number...");
      const result = await saveQuotation(payload);
      setForm((prev) => ({ ...prev, quotationNumber: result.quotationNumber || "" }));
      setStatus(
        `Quotation saved successfully.${
          result.quotationNumber ? ` Generated quotation number: ${result.quotationNumber}` : ""
        }`
      );
    } catch (error) {
      setStatus(`Could not save to Google Sheet. ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const generateQuotationPdf = async () => {
    if (!form.quotationNumber) {
      setStatus("Please save the quotation first before generating PDF.");
      return;
    }
    try {
      setPdfGenerating(true);
      setStatus("Generating quotation PDF...");
      const result = await generatePdf(form.quotationNumber);
      setStatus("Quotation PDF generated successfully.");
      window.open(result.pdfUrl, "_blank");
    } catch (error) {
      setStatus(`Could not generate quotation PDF. ${error.message}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  if (page === "search") {
    return <SearchPage onNavigateBack={() => setPage("quotation")} />;
  }

  return (
    <QuotationPage
      form={form}
      setForm={setForm}
      calculations={calculations}
      status={status}
      saving={saving}
      pdfGenerating={pdfGenerating}
      onSave={saveToGoogleSheet}
      onGeneratePdf={generateQuotationPdf}
      onNavigateSearch={() => setPage("search")}
      onReset={resetForm}
    />
  );
}
