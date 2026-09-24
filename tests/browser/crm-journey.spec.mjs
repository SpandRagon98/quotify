import { test, expect } from "@playwright/test";
import { databaseFixture } from "./database-fixture.mjs";
const nav = (page, name) => ({
  async click() {
    const target = page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true });
    if (await target.count() === 0) {
      const section = ['Overview', 'Presets', 'Quotations', 'Documents', 'Email'].includes(name) ? 'Sales'
        : name === 'Workflows' ? 'Automation' : name === 'Reports' ? 'Reports'
        : ['Settings', 'Team members', 'Roles & permissions'].includes(name) ? 'Admin' : 'CRM';
      const close = page.getByRole('button', { name: 'Close menu', exact: true });
      if (await close.isVisible()) await close.click();
      await page.getByRole('navigation', { name: 'Workspace sections' })
        .getByRole('button', { name: section, exact: true }).click();
    }
    const open = page.getByRole('button', { name: 'Open menu', exact: true });
    if (await open.isVisible() && !await target.isVisible()) await open.click();
    await target.click();
  },
});
test("Lead Inbox → assigned lead → follow-up → conversion → Kanban → Customer 360 → original quotation/PDF", async ({
  page,
}, testInfo) => {
  const fixture = await databaseFixture(page);
  const runtimeErrors = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Management dashboard" }),
    ).toBeVisible();
    await nav(page, "Lead Inbox").click();
    await page.getByRole("button", { name: "New enquiry" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Enquiry name").fill("Ada enquiry");
    await dialog.getByLabel("Company").fill("Analytical Engines");
    await dialog.getByLabel("Email", { exact: true }).fill("ada@test.invalid");
    await dialog.getByLabel("Phone", { exact: true }).fill("+91 90000 00000");
    await dialog
      .getByLabel("Owner", { exact: true })
      .selectOption(fixture.sales.id);
    await dialog.getByLabel("Source", { exact: true }).fill("Website");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Review / accept" }).click();
    await page.getByRole("button", { name: "Accept & create lead" }).click();
    await expect(
      page.getByRole("heading", { name: "Ada enquiry", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await dialog
      .getByLabel("Status", { exact: true })
      .selectOption("Qualified");
    await dialog.getByLabel("Estimated deal value (INR)").fill("50000");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Follow-up", exact: true }).click();
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Follow up with Ada");
    await dialog.getByLabel("Due date and time").fill("2026-09-20T10:00");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await nav(page, "Activities").click();
    await page.getByLabel("Activity view").selectOption("All");
    await page.getByLabel("Owner filter").selectOption(fixture.sales.id);
    await expect(
      page.getByRole("button", { name: "Follow up with Ada", exact: true }),
    ).toBeVisible();
    await nav(page, "Leads").click();
    await page
      .getByRole("button", { name: "Ada enquiry", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Convert lead", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Convert lead", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Analytical Engines", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Ada enquiry", exact: true }),
    ).toBeVisible();
    await nav(page, "Opportunities").click();
    await expect(
      page.getByRole("button", {
        name: "Ada enquiry opportunity",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Stage for Ada enquiry opportunity")
      .selectOption("Discovery");
    await expect(
      page
        .locator('.crm-lane[aria-label="Discovery"]')
        .getByRole("button", { name: "Ada enquiry opportunity", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ada enquiry opportunity", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Customer 360", exact: true })
      .click();
    await expect(
      page.getByText("Qualification → Discovery", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create quotation", exact: true })
      .first()
      .click();
    await dialog
      .getByLabel("Customer Name", { exact: true })
      .selectOption("Contact name");
    await dialog
      .getByLabel("Company Name", { exact: true })
      .selectOption("Company name");
    await dialog
      .getByLabel("Customer Email", { exact: true })
      .selectOption("Email");
    await dialog.getByLabel(/Quotation amount for CRM/).fill("50000");
    await dialog
      .getByLabel("Select opportunities", { exact: true })
      .selectOption({ label: "Ada enquiry opportunity" });
    await dialog
      .getByRole("button", { name: "Review in quotation form" })
      .click();
    await expect(page.getByLabel("Customer Name", { exact: true })).toHaveValue(
      "Ada enquiry",
    );
    await expect(page.getByLabel("Company Name", { exact: true })).toHaveValue(
      "Analytical Engines",
    );
    await page.getByLabel("Deal Value", { exact: true }).fill("50000");
    await page.getByRole("button", { name: /Preview/ }).click();
    await page
      .getByRole("button", { name: "Generate & Download PDF", exact: true })
      .click();
    await expect(page.getByText(/Opening print dialog/)).toBeVisible();
    await expect.poll(() => fixture.sheet.rows.length).toBe(1);
    const link = (
      await fixture.rows("select * from crm_quote_links where org_id=$1", [
        fixture.org,
      ])
    )[0];
    expect(link.account_id).toBeTruthy();
    expect(link.contact_id).toBeTruthy();
    expect(link.opportunity_id).toBeTruthy();
    expect(link.owner_id).toBe(fixture.sales.id);
    expect(link.quotation_id).toBe(fixture.sheet.rows[0][0]);
    expect(link.values_snapshot.company).toBe("Analytical Engines");
    // A second PDF action must reuse the saved ID, never append another quotation.
    await page
      .getByRole("button", { name: "Generate & Download PDF", exact: true })
      .click();
    await expect.poll(() => fixture.sheet.rows.length).toBe(1);
    await nav(page, "Dashboard").click();
    await expect(
      page.getByRole("heading", { name: "Management dashboard" }),
    ).toBeVisible();
    await nav(page, "Accounts").click();
    await page
      .getByRole("button", { name: "Analytical Engines", exact: true })
      .click();
    await page.getByRole("tab", { name: "Quotations", exact: true }).click();
    await expect(
      page.getByRole("button", { name: link.quotation_id, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: link.quotation_id, exact: true })
      .click();
    await expect(
      page.getByText("Saved CRM snapshot.", { exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("customer-quotation-desktop.png"),
      fullPage: true,
    });
    // Regression: an edit launched from the original Sales screen keeps its CRM links.
    await page
      .getByRole("button", { name: "Open original in Quotations", exact: true })
      .click();
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByLabel("Company Name", { exact: true })).toHaveValue(
      "Analytical Engines",
    );
    await page.getByLabel("Customer Name", { exact: true }).fill("Ada revised");
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Generate & Download PDF", exact: true })
      .click();
    await expect(page.getByText(/Opening print dialog/)).toBeVisible();
    expect(fixture.sheet.rows.length).toBe(1);
    const revised = (
      await fixture.rows("select * from crm_quote_links where id=$1", [link.id])
    )[0];
    expect(revised.values_snapshot.customer).toBe("Ada revised");
    expect(revised.account_id).toBe(link.account_id);
    expect(revised.contact_id).toBe(link.contact_id);
    expect(revised.opportunity_id).toBe(link.opportunity_id);
    expect(revised.owner_id).toBe(link.owner_id);
    expect(Number(revised.amount)).toBe(50000);
    expect(runtimeErrors).toEqual([]);
    expect(fixture.errors).toEqual([]);
  } finally {
    await fixture.db.close();
  }
});
test("workflows create activities and disabled rules remain inactive through the UI", async ({
  page,
}) => {
  const fixture = await databaseFixture(page);
  try {
    await page.goto("/");
    await nav(page, "Workflows").click();
    await page
      .getByRole("button", { name: "Create workflow", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Name", { exact: true })
      .fill("Contact new enquiry");
    await dialog.getByText("Enabled — run on future matching events").click();
    await dialog.getByRole("button", { name: "Save workflow" }).click();
    await expect(
      page.getByText("Contact new enquiry", { exact: true }),
    ).toBeVisible();
    await nav(page, "Leads").click();
    await page.getByRole("button", { name: "New lead" }).click();
    await dialog.getByLabel("Name").fill("Workflow browser enquiry");
    await dialog.getByLabel("Company").fill("Workflow test company");
    await dialog.getByRole("button", { name: "Create lead", exact: true }).click();
    await nav(page, "Activities").click();
    await page.getByLabel("Activity view").selectOption("All");
    await expect(
      page.getByRole("button", { name: "Contact new enquiry", exact: true }),
    ).toBeVisible();
    await nav(page, "Workflows").click();
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
    await nav(page, "Leads").click();
    await page.getByRole("button", { name: "New lead" }).click();
    await dialog.getByLabel("Name").fill("Disabled workflow enquiry");
    await dialog.getByLabel("Company").fill("Disabled workflow company");
    await dialog.getByRole("button", { name: "Create lead", exact: true }).click();
    expect(
      Number(
        (
          await fixture.rows(
            "select count(*) as n from crm_activities where title='Contact new enquiry'",
          )
        )[0].n,
      ),
    ).toBe(1);
    expect(fixture.errors).toEqual([]);
  } finally {
    await fixture.db.close();
  }
});
test("responsive navigation, themes and read-only Viewer UI", async ({
  page,
}, testInfo) => {
  const fixture = await databaseFixture(page, { role: "viewer" });
  const runtimeErrors = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Management dashboard" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await nav(page, "Leads").click();
    await expect(
      page.getByRole("heading", { name: "Leads", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New lead" })).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("leads-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open menu" }).click();
    await nav(page, "Settings").click();
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath("settings-dark-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Glass", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav(page, "Documents").click();
    await expect(page.getByRole("heading", { name: "Doc View" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload Logo" })).toHaveCount(
      0,
    );
    await page.screenshot({
      path: testInfo.outputPath("readonly-documents-desktop.png"),
      fullPage: true,
    });
    expect(runtimeErrors).toEqual([]);
    expect(fixture.errors).toEqual([]);
  } finally {
    await fixture.db.close();
  }
});
