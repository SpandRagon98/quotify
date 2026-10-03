// Local-only disposable backend for Playwright CLI sessions. Never live data.
import { createServer } from "node:http";
import { databaseFixture } from "./database-fixture.mjs";
const routes = [],
  scripts = [];
const fixture = await databaseFixture({
  addInitScript: async (fn, arg) => scripts.push({ fn: fn.toString(), arg }),
  route: async (pattern, handler) => routes.push({ pattern, handler }),
});
if (process.argv.includes("--seed")) {
  const ids = (
    await fixture.rows("select crm_quick_capture($1,$2,true) as result", [
      fixture.org,
      JSON.stringify({
        name: "Rahul Sharma",
        company_name: "Acme Industries",
        email: "rahul@example.test",
        phone: "9876543210",
        product: "Analytics consulting",
        estimated_value: 500000,
      }),
    ])
  )[0].result;
  await fixture.rows(
    "insert into app_state(org_id,key,data) values($1,'journey_setup',$2)",
    [
      fixture.org,
      JSON.stringify({
        completed: true,
        company: "Qyrova Demo Studio",
        step: 4,
        ...ids,
      }),
    ],
  );
  const doc = {
    kind: "Quotation",
    company: "Qyrova Demo Studio",
    customer_name: "Rahul Sharma",
    company_name: "Acme Industries",
    email: "rahul@example.test",
    items: [
      { name: "Analytics consulting", quantity: 1, price: 500000, discount: 0 },
    ],
    totals: { subtotal: 500000, discount: 0, tax: 0, total: 500000 },
    currency: "INR",
    tax_percent: 0,
    terms: "50% advance, balance on completion.",
    created_at: new Date().toISOString(),
  };
  await fixture.rows(
    "insert into crm_quote_links(org_id,owner_id,account_id,contact_id,opportunity_id,lead_id,preset_id,preset_name,quotation_id,amount,values_snapshot) values($1,$2,$3,$4,$5,$6,'native-quotation','Qyrova Quotation','QY-DEMO-104',500000,$7)",
    [
      fixture.org,
      fixture.admin.id,
      ids.account_id,
      ids.contact_id,
      ids.opportunity_id,
      ids.lead_id,
      JSON.stringify({ __journey: doc }),
    ],
  );
  await fixture.rows(
    "select crm_log_quote_email($1,'QY-DEMO-104','native-quotation','rahul@example.test')",
    [fixture.org],
  );
  await fixture.rows(
    "update crm_quote_links set sent_at=now()-interval '8 days' where quotation_id='QY-DEMO-104'",
  );
  await fixture.rows(
    "update crm_activities set due_at=now()+interval '2 hours' where opportunity_id=$1 and activity_type='Follow-up'",
    [ids.opportunity_id],
  );
}
const server = createServer(async (req, res) => {
  const local = new URL(req.url, "http://127.0.0.1:5180");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  if (local.pathname === "/init") {
    res.end(JSON.stringify(scripts));
    return;
  }
  if (local.pathname === "/state") {
    res.end(
      JSON.stringify({ errors: fixture.errors, emails: fixture.emailCount }),
    );
    return;
  }
  const original = local.searchParams.get("url");
  const handler = routes.find((r) =>
    original?.startsWith(r.pattern.split("**")[0]),
  )?.handler;
  if (!handler) {
    res.writeHead(404);
    res.end("{}");
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const request = {
    url: () => original,
    method: () => req.method,
    headers: () => req.headers,
    postDataJSON: () => (body ? JSON.parse(body) : null),
  };
  try {
    await handler({
      request: () => request,
      fulfill: async (options) => {
        res.writeHead(options.status || 200, {
          "Content-Type": options.contentType || "application/json",
          ...options.headers,
        });
        res.end(
          options.json ? JSON.stringify(options.json) : options.body || "",
        );
      },
    });
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ message: error.message }));
  }
});
server.listen(5180, "127.0.0.1", () =>
  console.log("Disposable CRM fixture http://127.0.0.1:5180"),
);
process.on("SIGINT", async () => {
  server.close();
  await fixture.db.close();
  process.exit(0);
});
