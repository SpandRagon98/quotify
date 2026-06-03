import { useState } from "react";
import DetailBox from "../components/DetailBox";
import { formatINR } from "../utils/formatters";
import {
  getClients,
  getQuotationNumbers,
  searchCustomer,
  generatePdf,
} from "../utils/api";

export default function SearchPage({ onNavigateBack }) {
  const [clientOptions, setClientOptions] = useState([]);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [searchClient, setSearchClient] = useState("");
  const [searchQuotationNumber, setSearchQuotationNumber] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  const fetchClients = async () => {
    try {
      setSearchLoading(true);
      setSearchStatus("Loading client names...");
      const result = await getClients();
      setClientOptions(result.clients || []);
      setClientsLoaded(true);
      setSearchStatus("");
    } catch (error) {
      setSearchStatus(`Could not load clients. ${error.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchQuotationNumbers = async (clientName) => {
    try {
      setSearchStatus("Loading quotation numbers...");
      const result = await getQuotationNumbers(clientName);
      setQuotationOptions(result.quotationNumbers || []);
      setSearchStatus("");
    } catch (error) {
      setQuotationOptions([]);
      setSearchStatus(`Could not load quotation numbers. ${error.message}`);
    }
  };

  const handleClientChange = async (clientName) => {
    setSearchClient(clientName);
    setSearchQuotationNumber("");
    setSearchResults([]);
    if (clientName) {
      await fetchQuotationNumbers(clientName);
    } else {
      setQuotationOptions([]);
    }
  };

  const handleSearch = async () => {
    if (!searchClient || !searchQuotationNumber) {
      setSearchStatus("Please select client name and quotation number.");
      return;
    }
    try {
      setSearchLoading(true);
      setSearchStatus("Searching customer details...");
      const result = await searchCustomer(searchClient, searchQuotationNumber);
      setSearchResults(result.records || []);
      setSearchStatus((result.records || []).length ? "" : "No matching records found.");
    } catch (error) {
      setSearchResults([]);
      setSearchStatus(`Could not search records. ${error.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const viewQuotationPdf = async (record) => {
    try {
      if (record.pdfFileUrl) {
        window.open(record.pdfFileUrl, "_blank");
        return;
      }
      setSearchStatus("Generating quotation PDF...");
      const result = await generatePdf(record.quotationNumber);
      window.open(result.pdfUrl, "_blank");
      setSearchStatus("Quotation PDF opened successfully.");
    } catch (error) {
      setSearchStatus(`Could not open quotation PDF. ${error.message}`);
    }
  };

  return (
    <div className="app-shell">
      <div className="page-wrap">
        <section className="hero-card">
          <div className="hero-content">
            <div>
              <div className="hero-badge">Customer Search</div>
              <h1 className="hero-title">Customer Search</h1>
              <p className="hero-subtitle">
                Search saved quotations by client name and address.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={onNavigateBack}>
              Back to Quotation
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Search Filters</h2>
          </div>

          <div className="search-grid">
            <div className="field field-bottom">
              <button
                className="btn btn-primary full-btn"
                onClick={fetchClients}
                disabled={searchLoading}
              >
                {searchLoading && !clientsLoaded ? "Loading..." : "Load Clients"}
              </button>
            </div>

            <div className="field">
              <label className="field-label">Client Name</label>
              <select
                className="input"
                value={searchClient}
                disabled={!clientsLoaded}
                onChange={(e) => handleClientChange(e.target.value)}
              >
                <option value="">
                  {clientsLoaded ? "Select client" : "Click Load Clients first"}
                </option>
                {clientOptions.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Quotation Number</label>
              <select
                className="input"
                value={searchQuotationNumber}
                disabled={!searchClient || !clientsLoaded}
                onChange={(e) => setSearchQuotationNumber(e.target.value)}
              >
                <option value="">
                  {searchClient ? "Select quotation number" : "Select client first"}
                </option>
                {quotationOptions.map((quotationNumber) => (
                  <option key={quotationNumber} value={quotationNumber}>
                    {quotationNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-bottom">
              <button
                className="btn btn-primary full-btn"
                onClick={handleSearch}
                disabled={searchLoading}
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {searchStatus ? <div className="status-box">{searchStatus}</div> : null}
        </section>

        <div className="results-stack">
          {searchResults.map((record, index) => (
            <section
              className="card"
              key={`${record.quotationNumber || "record"}-${index}`}
            >
              <div className="record-header">
                <div>
                  <h2 className="record-title">{record.clientName || "Customer Record"}</h2>
                  <div className="record-subtitle">{record.address || "—"}</div>
                </div>

                <div className="quote-pill">
                  <span className="quote-pill-label">Quotation Number</span>
                  <strong>{record.quotationNumber || "—"}</strong>
                  <button
                    className="btn btn-primary full-btn"
                    onClick={() => viewQuotationPdf(record)}
                  >
                    View Quotation PDF
                  </button>
                </div>
              </div>

              <div className="details-grid">
                <DetailBox label="Quotation Date" value={record.quotationDate} />
                <DetailBox label="Product Type" value={record.productType} />
                <DetailBox label="Client Name" value={record.clientName} />
                <DetailBox label="Company Name" value={record.companyName} />
                <DetailBox label="Company GST" value={record.companyGST} />
                <DetailBox label="Address" value={record.address} />
                <DetailBox label="Pin Code" value={record.pinCode} />
                <DetailBox label="Contact Number" value={record.contactNumber} />
                <DetailBox label="Email" value={record.email} />
                <DetailBox
                  label="Container Size"
                  value={`${record.containerLength || "—"} x ${record.containerWidth || "—"} x ${
                    record.containerHeight || "—"
                  } ft`}
                />
                <DetailBox
                  label="Calculated Cost"
                  value={record.calculatedCost ? formatINR(record.calculatedCost) : "—"}
                />
                <DetailBox
                  label="Final Price"
                  value={record.finalPrice ? formatINR(record.finalPrice) : "—"}
                />
                <DetailBox
                  label="Advance Payment"
                  value={record.advancePaymentValue ? formatINR(record.advancePaymentValue) : "—"}
                />
                <DetailBox
                  label="Balance Payment"
                  value={record.balancePayment ? formatINR(record.balancePayment) : "—"}
                />
                <DetailBox
                  label="Distance to Site"
                  value={record.distanceToSite ? `${record.distanceToSite} km` : "—"}
                />
                <DetailBox label="Partitions" value={record.partitions} />
                <DetailBox label="Doors" value={record.doors} />
                <DetailBox label="Windows" value={record.windows} />
                <DetailBox label="Bed" value={record.bed} />
                <DetailBox label="Bunk Bed (Twin Sharing)" value={record.bunkBed} />
                <DetailBox label="Workstation" value={record.workstation} />
                <DetailBox label="AC Provision" value={record.acProvision} />
                <DetailBox label="Toilet Unit" value={record.toiletUnit} />
                <DetailBox label="Insulation" value={record.insulation} />
                <DetailBox label="Glass Door" value={record.glassDoor} />
                <DetailBox label="False Ceiling" value={record.falseCeiling} />
                <DetailBox label="Managerial Table" value={record.managerialTable} />
                <DetailBox label="Conference Table" value={record.conferenceTable} />
                <DetailBox
                  label="Overhead File Cabinet"
                  value={record.overheadFileCabinet}
                />
                <DetailBox label="Epoxy Flooring" value={record.epoxyFlooring} />
                <DetailBox
                  label="Epoxy Flooring Cost"
                  value={record.epoxyFlooringCost ? formatINR(record.epoxyFlooringCost) : "—"}
                />
              </div>

              <div className="notes-card">
                <div className="notes-title">Notes</div>
                <div>{record.notes || "—"}</div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
