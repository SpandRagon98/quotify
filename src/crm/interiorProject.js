const field = (key, label, type, options = [], required = false) => ({
  id: `interior:${key}`,
  key: `custom_${key}`,
  kind: "custom",
  label,
  type,
  options,
  required,
});

export const INTERIOR_PROJECT_FIELDS = [
  field("property_type", "Property type", "select", ["Apartment", "Villa", "Independent house", "Builder floor", "Renovation", "Commercial"], true),
  field("bhk", "Home size", "select", ["Studio", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK", "Not sure"], true),
  field("carpet_area_sqft", "Carpet area (sq ft)", "number", [], true),
  field("city", "City", "select", ["Mumbai", "Delhi NCR", "Bengaluru", "Kolkata", "Hyderabad", "Chennai", "Pune", "Other"], true),
  field("locality", "Locality", "text", [], true),
  field("possession_status", "Property status", "select", ["Possession received", "Under construction", "Renovation in progress", "Planning stage"], true),
  field("possession_date", "Possession date", "date"),
  field("spaces", "Spaces to design", "multiselect", ["Full Home", "Living Room", "Kitchen", "Bedrooms", "Wardrobes", "Dining", "Home Office", "Bathrooms", "Balcony"], true),
  field("styles", "Preferred style", "multiselect", ["Modern Minimal", "Warm Contemporary", "Japandi", "Modern Indian", "Classic Luxury", "Scandinavian", "Organic Modern", "Industrial", "Not Sure Yet"], true),
  field("priorities", "Project priorities", "multiselect", ["Storage", "Premium Materials", "Easy Maintenance", "Child Friendly", "Pet Friendly", "Smart Home", "Natural Light", "Luxury Finish", "Vastu", "Sustainability"]),
  field("finish_level", "Finish level", "select", ["Essential", "Premium", "Luxury"], true),
  field("budget_range", "Budget comfort range", "select", ["Under ₹5 lakh", "₹5–10 lakh", "₹10–20 lakh", "₹20–35 lakh", "₹35–50 lakh", "₹50 lakh+", "Not sure"]),
  field("timeline", "Preferred timeline", "select", ["Immediately", "Within 3 months", "3–6 months", "6–12 months", "Just exploring"], true),
  field("inspiration_url", "Inspiration link", "text"),
  field("project_notes", "Tell us about your home", "textarea"),
];

export const DEFAULT_INTERIOR_PRICING = Object.freeze({
  rateBands: {
    Essential: { min: 1200, max: 1800 },
    Premium: { min: 1800, max: 2800 },
    Luxury: { min: 2800, max: 4500 },
  },
  cityMultipliers: {
    Mumbai: 1.18,
    "Delhi NCR": 1.1,
    Bengaluru: 1.12,
    Kolkata: 0.95,
    Hyderabad: 1,
    Chennai: 1,
    Pune: 1.05,
    Other: 1,
  },
  styleMultipliers: {
    "Modern Minimal": 0.95,
    "Warm Contemporary": 1,
    Japandi: 1.05,
    "Modern Indian": 1.1,
    "Classic Luxury": 1.25,
    Scandinavian: 1,
    "Organic Modern": 1.1,
    Industrial: 1.05,
    "Not Sure Yet": 1,
  },
  minimumProjectValue: 450000,
});

const spaceWeight = {
  "Living Room": 0.2,
  Kitchen: 0.22,
  Bedrooms: 0.38,
  Wardrobes: 0.18,
  Dining: 0.1,
  "Home Office": 0.1,
  Bathrooms: 0.13,
  Balcony: 0.06,
};

const list = (value) => Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

export function normalizeInteriorPricing(value) {
  const input = value && typeof value === "object" ? value : {};
  const rateBands = Object.fromEntries(Object.entries(DEFAULT_INTERIOR_PRICING.rateBands).map(([level, rates]) => {
    const supplied = input.rateBands?.[level] || {};
    const min = Number(supplied.min);
    const max = Number(supplied.max);
    return [level, {
      min: Number.isFinite(min) && min > 0 ? min : rates.min,
      max: Number.isFinite(max) && max >= min ? max : rates.max,
    }];
  }));
  return {
    rateBands,
    cityMultipliers: { ...DEFAULT_INTERIOR_PRICING.cityMultipliers, ...(input.cityMultipliers || {}) },
    styleMultipliers: { ...DEFAULT_INTERIOR_PRICING.styleMultipliers, ...(input.styleMultipliers || {}) },
    minimumProjectValue: Number(input.minimumProjectValue) > 0 ? Number(input.minimumProjectValue) : DEFAULT_INTERIOR_PRICING.minimumProjectValue,
  };
}

export function interiorEstimate(values, pricing) {
  const settings = normalizeInteriorPricing(pricing);
  const area = Number(values.custom_carpet_area_sqft);
  if (!Number.isFinite(area) || area <= 0) return null;
  const level = values.custom_finish_level || "Premium";
  const band = settings.rateBands[level] || settings.rateBands.Premium;
  const cityFactor = Number(settings.cityMultipliers[values.custom_city]) || 1;
  const styles = list(values.custom_styles);
  const styleFactor = Math.max(1, ...styles.map((style) => Number(settings.styleMultipliers[style]) || 1));
  const spaces = list(values.custom_spaces);
  const scopeFactor = spaces.includes("Full Home") || spaces.length === 0
    ? 1
    : Math.min(0.95, Math.max(0.16, [...new Set(spaces)].reduce((total, space) => total + (spaceWeight[space] || 0), 0)));
  const factor = cityFactor * styleFactor * scopeFactor;
  const minimum = scopeFactor === 1 ? settings.minimumProjectValue : 0;
  const low = Math.max(minimum, Math.round(area * band.min * factor / 1000) * 1000);
  const high = Math.max(low, Math.round(area * band.max * factor / 1000) * 1000);
  return { low, high, rateLow: Math.round(band.min * factor), rateHigh: Math.round(band.max * factor), currency: "INR" };
}

export function applyInteriorProjectTemplate(existing = []) {
  const interiorKeys = new Set(INTERIOR_PROJECT_FIELDS.map((item) => item.key));
  const otherFields = existing.filter((item) => !String(item.id || "").startsWith("interior:") && !interiorKeys.has(item.key));
  return [...otherFields, ...INTERIOR_PROJECT_FIELDS];
}
