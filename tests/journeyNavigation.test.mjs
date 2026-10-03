import { test } from "node:test";
import assert from "node:assert/strict";
import { PRIMARY_NAV, primarySection } from "../src/crm/navigation.js";
import { allowedTabs } from "../src/auth/roles.js";
test("primary navigation is journey-led and preserves permission-limited roles", () => {
  assert.deepEqual(
    PRIMARY_NAV.map(([, label]) => label),
    ["Home", "Customers", "Deals", "Tasks", "Documents", "Reports"],
  );
  assert.equal(
    PRIMARY_NAV.filter(([key]) => allowedTabs("owner").includes(key)).length,
    6,
  );
  assert.deepEqual(
    PRIMARY_NAV.filter(([key]) => allowedTabs("doc_viewer").includes(key)).map(
      ([, label]) => label,
    ),
    ["Documents"],
  );
  assert.equal(allowedTabs("finance").includes("tasks"), false);
  assert.equal(allowedTabs("sales_user").includes("users"), false);
});
test("legacy routes still select the appropriate primary section", () => {
  for (const route of ["accounts", "contacts", "leads"])
    assert.equal(primarySection(route), "customers");
  for (const route of ["quote_wizard", "docview", "preview"])
    assert.equal(primarySection(route), "documents");
  for (const route of ["presets", "users", "workflows", "permissions"])
    assert.equal(primarySection(route), "settings");
  assert.equal(primarySection("activities"), "tasks");
});
