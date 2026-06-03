import { safeNumber } from "./formatters";
import { APPS_SCRIPT_URL } from "../data/constants";

export function buildPayload(form, calculations) {
  return {
    quotationNumber: form.quotationNumber,
    quotationDate: form.quotationDate,
    productType: form.productType,
    clientName: form.clientName,
    companyName: form.companyName,
    companyGST: form.companyGST,
    address: form.projectLocation,
    pinCode: form.pinCode,
    contactNumber: form.contactNumber,
    email: form.email,
    notes: form.notes,
    containerLength: safeNumber(form.containerLength),
    containerWidth: safeNumber(form.containerWidth),
    containerHeight: safeNumber(form.containerHeight),
    distanceToSite: safeNumber(form.distanceToSite),
    partitions: safeNumber(form.partitions),
    doors: safeNumber(form.doors),
    windows: safeNumber(form.windows),
    bed: safeNumber(form.bed),
    bunkBed: safeNumber(form.bunkBed),
    workstation: safeNumber(form.workstation),
    priceBeforeGst: safeNumber(form.priceBeforeGst),
    enteredPriceBeforeGst: safeNumber(form.priceBeforeGst),
    advancePaymentPercentage: safeNumber(form.advancePaymentPercentage),
    acProvision: form.acProvision ? "Yes" : "No",
    toiletUnit: form.toiletUnit ? "Yes" : "No",
    insulation: form.insulation ? "Yes" : "No",
    glassDoor: form.glassDoor ? "Yes" : "No",
    falseCeiling: form.falseCeiling ? "Yes" : "No",
    managerialTable: form.managerialTable ? "Yes" : "No",
    conferenceTable: form.conferenceTable ? "Yes" : "No",
    overheadFileCabinet: form.overheadFileCabinet ? "Yes" : "No",
    epoxyFlooring: form.epoxyFlooring ? "Yes" : "No",
    calculatedCost: Math.round(calculations.calculatedCost),
    bedCost: Math.round(calculations.bedCost),
    bunkBedCost: Math.round(calculations.bunkBedCost),
    workstationCost: Math.round(calculations.workstationCost),
    epoxyFlooringCost: Math.round(calculations.epoxyFlooringCost),
    gst18Percent: Math.round(calculations.gst),
    finalPrice: Math.round(calculations.finalPrice),
    advancePaymentValue: Math.round(calculations.advancePaymentValue),
    balancePayment: Math.round(calculations.balancePayment),
  };
}

export async function saveQuotation(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to save");
  return result;
}

export async function generatePdf(quotationNumber) {
  const response = await fetch(
    `${APPS_SCRIPT_URL}?action=generateQuotationPdf&quotationNumber=${encodeURIComponent(quotationNumber)}`
  );
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to generate PDF");
  return result;
}

export async function getClients() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=getClients`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to load clients");
  return result;
}

export async function getQuotationNumbers(clientName) {
  const response = await fetch(
    `${APPS_SCRIPT_URL}?action=getQuotationNumbers&clientName=${encodeURIComponent(clientName)}`
  );
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to load quotation numbers");
  return result;
}

export async function searchCustomer(clientName, quotationNumber) {
  const response = await fetch(
    `${APPS_SCRIPT_URL}?action=searchCustomer&clientName=${encodeURIComponent(
      clientName
    )}&quotationNumber=${encodeURIComponent(quotationNumber)}`
  );
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Search failed");
  return result;
}
