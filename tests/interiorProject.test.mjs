import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInteriorProjectTemplate,
  DEFAULT_INTERIOR_PRICING,
  interiorEstimate,
} from "../src/crm/interiorProject.js";

test("interior project template preserves unrelated configured fields", () => {
  const fields = applyInteriorProjectTemplate([{ id: "custom:referral", key: "custom_referral", kind: "custom", label: "Referral", type: "text", options: [], required: false }]);
  assert.equal(fields.some((field) => field.key === "custom_referral"), true);
  assert.equal(fields.some((field) => field.key === "custom_carpet_area_sqft"), true);
  assert.equal(fields.some((field) => field.key === "custom_styles" && field.type === "multiselect"), true);
});

test("interior estimates honour city, style and partial-scope factors", () => {
  const full = interiorEstimate({ custom_carpet_area_sqft: 1000, custom_finish_level: "Premium", custom_city: "Kolkata", custom_styles: ["Warm Contemporary"], custom_spaces: ["Full Home"] }, DEFAULT_INTERIOR_PRICING);
  const partial = interiorEstimate({ custom_carpet_area_sqft: 1000, custom_finish_level: "Premium", custom_city: "Kolkata", custom_styles: ["Warm Contemporary"], custom_spaces: ["Kitchen"] }, DEFAULT_INTERIOR_PRICING);
  const luxuryMumbai = interiorEstimate({ custom_carpet_area_sqft: 1000, custom_finish_level: "Luxury", custom_city: "Mumbai", custom_styles: ["Classic Luxury"], custom_spaces: ["Full Home"] }, DEFAULT_INTERIOR_PRICING);
  assert.equal(full.low, 1710000);
  assert.ok(partial.low < full.low);
  assert.ok(luxuryMumbai.low > full.high);
});
