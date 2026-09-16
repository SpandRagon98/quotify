// Isolated, signed-out hosted smoke test. No production customer writes or email.
import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const origin = "https://qyrova.spandan305.workers.dev";
const local = readFileSync("dist/index.html", "utf8");
const deployed = await fetch(origin, { signal: AbortSignal.timeout(15000) });
if (!deployed.ok) throw new Error(`Hosted app returned ${deployed.status}`);
const html = await deployed.text();
const assets = [...local.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
  (match) => match[1],
);
for (const asset of assets) {
  if (!html.includes(asset))
    throw new Error("Hosted app does not match the validated build");
  const response = await fetch(origin + asset, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Hosted asset failed (${response.status})`);
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeVisible();
  if (errors.length)
    throw new Error(`Hosted runtime error: ${errors.join("; ")}`);
  console.log(
    "Hosted app: validated assets available; signed-out login opens without runtime errors",
  );
  await page.goto(origin + "/q/crm-release-check-invalid-token", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page
      .getByText(/not found|not available|couldn.t|unavailable|invalid/i)
      .first(),
  ).toBeVisible({ timeout: 20000 });
  if (errors.length)
    throw new Error(`Public route runtime error: ${errors.join("; ")}`);
  console.log(
    "Public quotation route: invalid token handled without opening the private app or a runtime error",
  );
} finally {
  await browser.close();
}
