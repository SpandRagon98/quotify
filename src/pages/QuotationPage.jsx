import Field from "../components/Field";
import ToggleField from "../components/ToggleField";
import DetailBox from "../components/DetailBox";
import { formatINR, safeNumber } from "../utils/formatters";
import { GST_PERCENT, PRODUCT_TYPES } from "../data/constants";

export default function QuotationPage({
  form,
  setForm,
  calculations,
  status,
  saving,
  pdfGenerating,
  onSave,
  onGeneratePdf,
  onNavigateSearch,
  onReset,
}) {
  return (
    <div className="app-shell">
      <div className="page-wrap">
        <section className="hero-card">
          <div className="hero-content">
            <div>
              <div className="hero-badge">Quotation Automation</div>
              <h1 className="hero-title">R.K. Enterprise Quotation Automation App</h1>
              <p className="hero-subtitle">
                Generate container quotations and save them to Google Sheets.
              </p>
            </div>

            <div className="hero-side">
              <div className="quote-summary">
                <div className="summary-row">
                  <span>Quotation No.</span>
                  <strong>
                    {form.quotationNumber ? form.quotationNumber : "Shown after save"}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Quotation Date</span>
                  <strong>{form.quotationDate || "—"}</strong>
                </div>
              </div>

              <button className="btn btn-secondary full-btn" onClick={onNavigateSearch}>
                Customer Search
              </button>
            </div>
          </div>
        </section>

        <div className="main-grid">
          <section className="card">
            <div className="section-header">
              <h2>Quotation Inputs</h2>
              <button className="btn btn-secondary" onClick={onReset}>
                + New
              </button>
            </div>

            <div className="field product-type-field">
              <label className="field-label">Product Type</label>
              <select
                className="input"
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
              >
                <option value="">Select Product Type</option>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid two-col">
              <Field
                label="Client Name"
                value={form.clientName}
                onChange={(v) => setForm({ ...form, clientName: v })}
              />
              <Field
                label="Company Name"
                value={form.companyName}
                onChange={(v) => setForm({ ...form, companyName: v })}
              />
              <Field
                label="Company GST"
                value={form.companyGST}
                onChange={(v) => setForm({ ...form, companyGST: v })}
              />
              <Field
                label="Address"
                value={form.projectLocation}
                onChange={(v) => setForm({ ...form, projectLocation: v })}
              />
              <Field
                label="Pin Code"
                value={form.pinCode}
                onChange={(v) => setForm({ ...form, pinCode: v })}
              />
              <Field
                label="Contact Number"
                value={form.contactNumber}
                onChange={(v) => setForm({ ...form, contactNumber: v })}
              />
              <Field
                label="Email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                label="Quotation Date"
                type="date"
                value={form.quotationDate}
                onChange={(v) => setForm({ ...form, quotationDate: v })}
              />
            </div>

            <div className="divider" />

            <h3 className="subsection-title">Container Configuration</h3>
            <div className="form-grid three-col">
              <div className="field">
                <label className="field-label">Container Length (ft)</label>
                <select
                  className="input"
                  value={form.containerLength}
                  onChange={(e) =>
                    setForm({ ...form, containerLength: safeNumber(e.target.value) })
                  }
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={40}>40</option>
                </select>
              </div>

              <Field
                label="Container Width (ft)"
                type="number"
                value={10}
                onChange={() => {}}
                readOnly
              />
              <Field
                label="Container Height (ft)"
                type="number"
                value={9}
                onChange={() => {}}
                readOnly
              />
              <Field
                label="Distance to Site (km)"
                type="number"
                value={form.distanceToSite}
                onChange={(v) => setForm({ ...form, distanceToSite: v })}
              />
              <Field
                label="Partitions"
                type="number"
                value={form.partitions}
                onChange={(v) => setForm({ ...form, partitions: v })}
              />
              <Field
                label="Doors"
                type="number"
                value={form.doors}
                onChange={(v) => setForm({ ...form, doors: v })}
              />
              <Field
                label="Windows"
                type="number"
                value={form.windows}
                onChange={(v) => setForm({ ...form, windows: v })}
              />
              <Field
                label="Bed"
                type="number"
                value={form.bed}
                onChange={(v) => setForm({ ...form, bed: v })}
              />
              <Field
                label="Bunk Bed (Twin Sharing)"
                type="number"
                value={form.bunkBed}
                onChange={(v) => setForm({ ...form, bunkBed: v })}
              />
              <Field
                label="Workstation"
                type="number"
                value={form.workstation}
                onChange={(v) => setForm({ ...form, workstation: v })}
              />
              <Field
                label="Price Before GST"
                type="number"
                value={form.priceBeforeGst}
                onChange={(v) => setForm({ ...form, priceBeforeGst: v })}
              />
              <div className="field">
                <label className="field-label">Advance Payment Percentage</label>
                <div className="percentage-input-wrap">
                  <input
                    className="input"
                    type="number"
                    value={form.advancePaymentPercentage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        advancePaymentPercentage:
                          e.target.value === "" ? "" : safeNumber(e.target.value),
                      })
                    }
                  />
                  <span className="percentage-symbol">%</span>
                </div>
              </div>
            </div>

            <div className="divider" />

            <h3 className="subsection-title">Optional Features</h3>
            <div className="toggle-grid">
              <ToggleField
                label="AC Provision"
                checked={form.acProvision}
                onChange={(v) => setForm({ ...form, acProvision: v })}
              />
              <ToggleField
                label="Toilet Unit"
                checked={form.toiletUnit}
                onChange={(v) => setForm({ ...form, toiletUnit: v })}
              />
              <ToggleField
                label="Insulation"
                checked={form.insulation}
                onChange={(v) => setForm({ ...form, insulation: v })}
              />
              <ToggleField
                label="Glass Door"
                checked={form.glassDoor}
                onChange={(v) => setForm({ ...form, glassDoor: v })}
              />
              <ToggleField
                label="False Ceiling"
                checked={form.falseCeiling}
                onChange={(v) => setForm({ ...form, falseCeiling: v })}
              />
              <ToggleField
                label="Managerial Table"
                checked={form.managerialTable}
                onChange={(v) => setForm({ ...form, managerialTable: v })}
              />
              <ToggleField
                label="Conference Table"
                checked={form.conferenceTable}
                onChange={(v) => setForm({ ...form, conferenceTable: v })}
              />
              <ToggleField
                label="Overhead File Cabinet"
                checked={form.overheadFileCabinet}
                onChange={(v) => setForm({ ...form, overheadFileCabinet: v })}
              />
              <ToggleField
                label="Epoxy Flooring"
                checked={form.epoxyFlooring}
                onChange={(v) => setForm({ ...form, epoxyFlooring: v })}
              />
            </div>

            <div className="field notes-field">
              <label className="field-label">Notes</label>
              <textarea
                className="textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={5}
              />
            </div>
          </section>

          <section className="card preview-card">
            <h2 className="preview-title">Quotation Preview</h2>

            <div className="preview-grid">
              <DetailBox label="Product Type" value={form.productType || "—"} />
              <DetailBox label="Client" value={form.clientName || "—"} />
              <DetailBox label="Address" value={form.projectLocation || "—"} />
              <DetailBox label="Container Size" value={`${form.containerLength} x 10 x 9 ft`} />
              <DetailBox label="Floor Area" value={`${calculations.area} sqft`} />
              <DetailBox label="Calculated Cost" value={formatINR(calculations.calculatedCost)} />
              <DetailBox label="GST" value={formatINR(calculations.gst)} />
              <DetailBox label="Final Quote" value={formatINR(calculations.finalPrice)} />
            </div>

            <div className="price-card">
              <div className="price-row">
                <span>Calculated Cost</span>
                <strong>{formatINR(calculations.calculatedCost)}</strong>
              </div>
              <div className="price-row">
                <span>Entered Price Before GST</span>
                <strong>{formatINR(form.priceBeforeGst)}</strong>
              </div>
              <div className="price-row">
                <span>Bed Cost</span>
                <strong>{formatINR(calculations.bedCost)}</strong>
              </div>
              <div className="price-row">
                <span>Bunk Bed Cost</span>
                <strong>{formatINR(calculations.bunkBedCost)}</strong>
              </div>
              <div className="price-row">
                <span>Workstation Cost</span>
                <strong>{formatINR(calculations.workstationCost)}</strong>
              </div>
              <div className="price-row">
                <span>Epoxy Flooring Cost</span>
                <strong>{formatINR(calculations.epoxyFlooringCost)}</strong>
              </div>
              <div className="price-row">
                <span>GST ({GST_PERCENT}%)</span>
                <strong>{formatINR(calculations.gst)}</strong>
              </div>
              <div className="divider small" />
              <div className="price-row total">
                <span>Final Price</span>
                <strong>{formatINR(calculations.finalPrice)}</strong>
              </div>
              <div className="price-row">
                <span>Advance Payment</span>
                <strong>{formatINR(calculations.advancePaymentValue)}</strong>
              </div>
              <div className="price-row">
                <span>Balance Payment</span>
                <strong>{formatINR(calculations.balancePayment)}</strong>
              </div>
            </div>

            <button
              className="btn btn-primary full-btn"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Non-Cost Data to Sheet"}
            </button>

            <button
              className="btn btn-secondary full-btn"
              onClick={onGeneratePdf}
              disabled={pdfGenerating || !form.quotationNumber}
            >
              {pdfGenerating ? "Generating PDF..." : "Generate Quotation PDF"}
            </button>

            <div className="info-box">
              Quotation number will be generated only when you save.
            </div>

            {status ? <div className="status-box">{status}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
