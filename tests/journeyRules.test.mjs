import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pulse,
  parseSearch,
  extractCapture,
  taskRank,
} from "../src/crm/brain.js";
import { calculateDocument } from "../src/crm/documentModel.js";
const now = Date.parse("2026-10-03T12:00:00Z");
const daysAgo = (days) => new Date(now - days * 86400000).toISOString();
test("Pulse explains stale quotes, expiry, recent replies and overdue work", () => {
  const quote = {
    stage: "Proposal/Quotation",
    quote_sent_at: daysAgo(4),
    quote_status: "Sent",
    next_due_at: new Date(now + 86400000).toISOString(),
  };
  assert.equal(pulse(quote, now).level, "Needs Attention");
  assert.equal(
    pulse({ ...quote, quote_sent_at: daysAgo(8) }, now).level,
    "At Risk",
  );
  assert.equal(
    pulse(
      {
        ...quote,
        quote_sent_at: daysAgo(1),
        quote_expires_at: new Date(now + 86400000).toISOString(),
      },
      now,
    ).level,
    "At Risk",
  );
  assert.equal(
    pulse({ ...quote, reply_at: daysAgo(1) }, now).level,
    "On Track",
  );
  assert.equal(pulse({ ...quote, reply_at: daysAgo(5) }, now).awaiting, true);
  assert.equal(
    pulse({ ...quote, reply_at: daysAgo(1), overdue_count: 1 }, now).level,
    "At Risk",
  );
  assert.equal(pulse({ ...quote, stage: "Won" }, now).type, "Invoice");
  assert.equal(
    pulse(quote, now, { quote_attention_days: 5 }).level,
    "On Track",
  );
});
test("Pulse recommends next steps after meetings and unattended enquiries", () => {
  assert.equal(
    pulse({ stage: "Discovery", meeting_at: daysAgo(1) }, now).action,
    "Add next step",
  );
  assert.equal(
    pulse({ stage: "Qualification", created_at: daysAgo(2) }, now).action,
    "Contact customer",
  );
  assert.equal(pulse({ stage: "Demo/Meeting" }, now).type, "Quotation");
});
test("natural search parses Indian values, dates, history and task filters without AI", () => {
  assert.deepEqual(parseSearch("show deals over 2 lakh").filters, {
    min_value: 200000,
  });
  assert.equal(parseSearch("deals above ₹5 lakh").filters.min_value, 500000);
  assert.equal(
    parseSearch(
      "Show invoices from September",
      new Date("2026-10-03T12:00:00Z"),
    ).filters.document_kind,
    "Invoice",
  );
  assert.equal(
    parseSearch("Which quotes are waiting for reply?").filters.awaiting,
    true,
  );
  assert.equal(parseSearch("What happened with Acme?").summary, true);
  assert.equal(parseSearch("What is Rahul's phone number?").query, "Rahul");
  assert.equal(
    parseSearch("Who needs follow-up today?").filters.activity_view,
    "Today",
  );
  assert.equal(
    parseSearch("Show customers I haven't contacted in 7 days").filters
      .inactive_days,
    7,
  );
});
test("quick capture proposes editable details and never invents missing names", async () => {
  const result = await extractCapture(
    "Hi Spandan, this is Rahul from Acme Industries. We need analytics consulting for around 3 months. Budget approximately ₹5 lakh. Can we meet next Thursday?",
  );
  assert.equal(result.name, "Rahul");
  assert.equal(result.company_name, "Acme Industries");
  assert.equal(result.product, "analytics consulting");
  assert.equal(result.estimated_value, 500000);
  assert.equal(result.timeline, "3 months");
  assert.equal(result.next_action, "Schedule meeting");
  assert.equal((await extractCapture("Can you send a quote?")).name, "");
});
test("task ranking puts overdue, urgent customer work above routine future work", () => {
  assert.ok(
    taskRank(
      { due_at: daysAgo(1), priority: "High" },
      { amount: 500000 },
      now,
    ) >
      taskRank(
        {
          due_at: new Date(now + 86400000 * 2).toISOString(),
          priority: "Normal",
        },
        {},
        now,
      ),
  );
  assert.equal(taskRank({ status: "Completed" }, {}, now), -1);
});
test("document amounts calculate discount before tax and reject invalid prices", () => {
  assert.deepEqual(
    calculateDocument([{ quantity: 2, price: 1000, discount: 10 }], 18),
    { subtotal: 2000, discount: 200, tax: 324, total: 2124 },
  );
  assert.throws(() => calculateDocument([{ quantity: 0, price: 2 }]));
  assert.throws(() => calculateDocument([{ quantity: 1, price: -2 }]));
  assert.throws(() =>
    calculateDocument([{ quantity: 1, price: 2, discount: 101 }]),
  );
});
