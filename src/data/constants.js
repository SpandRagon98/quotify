export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwNgTqLq1fClk326-nQqoqis8_g-iBWLBKCz8sI5j_sRtks2Ki1F-CLyVSx-wqvXVQ0Zg/exec";

export const GST_PERCENT = 18;

export const PRODUCT_TYPES = [
  "Casa UNO",
  "Casa DUO",
  "Office POD",
  "Security CABIN",
  "Casa ELEVE",
  "Cafe CARGO",
  "Dome",
  "Storage Container",
  "Cargo Crash",
];

export const initialForm = {
  quotationNumber: "",
  quotationDate: new Date().toISOString().split("T")[0],
  productType: "",
  clientName: "",
  companyName: "",
  companyGST: "",
  projectLocation: "",
  pinCode: "",
  contactNumber: "",
  email: "",
  notes: "",
  containerLength: 10,
  containerWidth: 10,
  containerHeight: 9,
  distanceToSite: "",
  partitions: "",
  doors: "",
  windows: "",
  bed: "",
  bunkBed: "",
  workstation: "",
  priceBeforeGst: "",
  advancePaymentPercentage: "",
  acProvision: false,
  toiletUnit: false,
  insulation: false,
  glassDoor: false,
  falseCeiling: false,
  managerialTable: false,
  conferenceTable: false,
  overheadFileCabinet: false,
  epoxyFlooring: false,
};
