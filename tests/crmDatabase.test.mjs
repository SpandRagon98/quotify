import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const pg = new PGlite();
let isolatedTransaction = false;
let admin,
  sales,
  viewer,
  stranger,
  org,
  otherOrg,
  lead,
  account,
  contact,
  opportunity;
const q = async (sql, params = []) => {
  if (isolatedTransaction) await pg.exec("savepoint expected_validation");
  try {
    const result = (await pg.query(sql, params)).rows;
    if (isolatedTransaction)
      await pg.exec("release savepoint expected_validation");
    return result;
  } catch (e) {
    if (isolatedTransaction)
      await pg.exec(
        "rollback to savepoint expected_validation; release savepoint expected_validation",
      );
    throw new Error(e.message);
  }
};
async function as(user, fn) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  await pg.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}
before(async () => {
  await pg.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const name of [
    "0001_init",
    "0002_tracked_quotes",
    "0003_quote_lifecycle",
    "0004_crm_foundation",
    "0005_crm_operations",
    "0006_crm_workflows",
    "0008_crm_queries",
    "0009_crm_email_history",
    "0010_telegram_lead_inbox",
  ]) {
    const sql = await readFile(
      new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
      "utf8",
    );
    try {
      await pg.exec(
        sql.replace('create extension if not exists "pgcrypto";', ""),
      );
    } catch (e) {
      throw new Error(`${name}: ${e.message}`);
    }
  }
  const users = await q(
    "insert into auth.users(email) values ('admin@test.invalid'),('sales@test.invalid'),('viewer@test.invalid'),('stranger@test.invalid') returning id",
  );
  [admin, sales, viewer, stranger] = users.map((x) => x.id);
  org = (await q("select default_org_id from profiles where id=$1", [admin]))[0]
    .default_org_id;
  otherOrg = (
    await q("select default_org_id from profiles where id=$1", [stranger])
  )[0].default_org_id;
  await q(
    "insert into org_members(org_id,user_id,role) values ($1,$2,'sales_user'),($1,$3,'viewer')",
    [org, sales, viewer],
  );
});
after(async () => pg.close());
test("quotation email history uses a narrow authorized RPC, including Finance", async () => {
  await pg.exec("begin");
  isolatedTransaction = true;
  try {
    const finance = (
      await q(
        "insert into auth.users(email) values('finance@test.invalid') returning id",
      )
    )[0].id;
    await q(
      "insert into org_members(org_id,user_id,role) values($1,$2,'finance')",
      [org, finance],
    );
    const customer = (
      await q(
        "insert into crm_accounts(org_id,owner_id,name) values($1,$2,'Email history customer') returning id",
        [org, sales],
      )
    )[0].id;
    await q(
      "insert into crm_quote_links(org_id,owner_id,account_id,preset_id,preset_name,quotation_id) values($1,$2,$3,'history-preset','History quotation','QYR-HISTORY')",
      [org, sales, customer],
    );
    await as(finance, async () => {
      await q(
        "select crm_log_quote_email($1,'QYR-HISTORY','history-preset','recipient@test.invalid')",
        [org],
      );
      assert.equal(
        (
          await q(
            "select count(*)::int as n from crm_events where account_id=$1 and event_type='quote_email_reported'",
            [customer],
          )
        )[0].n,
        1,
      );
      assert.equal(
        (await q("select count(*)::int as n from crm_activities"))[0].n,
        0,
      );
      await assert.rejects(
        q(
          "select crm_log_quote_email($1,'QYR-HISTORY','history-preset','invalid')",
          [org],
        ),
        /Invalid recipient/,
      );
    });
    await as(viewer, () =>
      assert.rejects(
        q(
          "select crm_log_quote_email($1,'QYR-HISTORY','history-preset','recipient@test.invalid')",
          [org],
        ),
        /Quotation access/,
      ),
    );
    await as(stranger, () =>
      assert.rejects(
        q(
          "select crm_log_quote_email($1,'QYR-HISTORY','history-preset','recipient@test.invalid')",
          [org],
        ),
        /Workspace membership/,
      ),
    );
  } finally {
    await pg.exec("rollback; reset role");
    isolatedTransaction = false;
  }
});
test("lead CRUD, indexed search, filters and atomic idempotent conversion", async () => {
  await as(admin, async () => {
    lead = (
      await q(
        "insert into crm_leads(org_id,owner_id,name,company_name,first_name,email,phone,source,estimated_value) values($1,$2,'Ada enquiry','Analytical Engines','Ada','ada@test.invalid','+91 90000 00000','Website',50000) returning id",
        [org, sales],
      )
    )[0].id;
    await q("update crm_leads set status='Qualified' where id=$1", [lead]);
    assert.equal(
      (
        await q(
          "select id from crm_leads where org_id=$1 and search @@ websearch_to_tsquery('simple','Ada') and status='Qualified'",
          [org],
        )
      ).length,
      1,
    );
    const converted = (
      await q("select crm_convert_lead($1) as result", [lead])
    )[0].result;
    account = converted.account_id;
    contact = converted.contact_id;
    opportunity = converted.opportunity_id;
    assert.ok(account && contact && opportunity);
    assert.equal(
      (await q("select crm_convert_lead($1) as result", [lead]))[0].result
        .already,
      true,
    );
    assert.equal(
      (
        await q("select count(*)::int as n from crm_accounts where org_id=$1", [
          org,
        ])
      )[0].n,
      1,
    );
  });
});
test("multiple contacts, server stage probabilities and Won/Lost validation", async () => {
  await as(admin, async () => {
    await q(
      "insert into crm_contacts(org_id,owner_id,account_id,first_name) values($1,$2,$3,'Grace')",
      [org, sales, account],
    );
    assert.equal(
      (await q("select id from crm_contacts where account_id=$1", [account]))
        .length,
      2,
    );
    await q("update crm_opportunities set stage='Negotiation' where id=$1", [
      opportunity,
    ]);
    assert.equal(
      (
        await q("select probability from crm_opportunities where id=$1", [
          opportunity,
        ])
      )[0].probability,
      80,
    );
    await assert.rejects(
      q("update crm_opportunities set stage='Lost' where id=$1", [opportunity]),
      /lost reason/i,
    );
    await q("update crm_opportunities set stage='Won' where id=$1", [
      opportunity,
    ]);
    const won = (
      await q(
        "select probability,closed_at from crm_opportunities where id=$1",
        [opportunity],
      )
    )[0];
    assert.equal(won.probability, 100);
    assert.ok(won.closed_at);
    await q("update crm_opportunities set stage='Discovery' where id=$1", [
      opportunity,
    ]);
  });
});
test("activities complete/reschedule/overdue and durable scheduled notification dedupe", async () => {
  let activity;
  await as(sales, async () => {
    activity = (
      await q(
        "insert into crm_activities(org_id,account_id,owner_id,title,due_at) values($1,$2,$3,'Call Ada',now()-interval '1 hour') returning id,status",
        [org, account, sales],
      )
    )[0];
    assert.equal(activity.status, "Overdue");
  });
  await pg.exec("select crm_private.tick(); select crm_private.tick();");
  assert.equal(
    (
      await q(
        "select count(*)::int as n from crm_notifications where entity_id=$1 and dedupe_key like 'overdue:%'",
        [activity.id],
      )
    )[0].n,
    1,
  );
  await as(sales, async () => {
    await q(
      "update crm_activities set status='Completed',outcome='Discussed proposal' where id=$1",
      [activity.id],
    );
    assert.ok(
      (
        await q("select completed_at from crm_activities where id=$1", [
          activity.id,
        ])
      )[0].completed_at,
    );
    await q(
      "update crm_activities set status='Pending',due_at=now()+interval '1 day' where id=$1",
      [activity.id],
    );
    assert.equal(
      (
        await q("select status from crm_activities where id=$1", [activity.id])
      )[0].status,
      "Pending",
    );
  });
});
test("direct SQL/API authorization: anonymous, other workspace, Viewer, ownership, forged relationships", async () => {
  await as(null, () =>
    assert.rejects(q("select * from crm_leads"), /permission denied/i),
  );
  await as(stranger, async () => {
    assert.equal(
      (await q("select id from crm_leads where org_id=$1", [org])).length,
      0,
    );
    await assert.rejects(
      q("select crm_convert_lead($1)", [lead]),
      /unavailable/i,
    );
    await assert.rejects(
      q(
        "insert into crm_contacts(org_id,owner_id,account_id,first_name) values($1,$2,$3,'Intruder')",
        [otherOrg, stranger, account],
      ),
      /unavailable|foreign key/i,
    );
  });
  await as(viewer, async () => {
    assert.equal(
      (await q("select id from crm_accounts where org_id=$1", [org])).length,
      1,
    );
    await assert.rejects(
      q(
        "insert into crm_leads(org_id,owner_id,name) values($1,$2,'Forbidden')",
        [org, viewer],
      ),
      /row-level security/i,
    );
    assert.equal(
      (
        await q("select crm_can($1,'leads','export',$2) as allowed", [
          org,
          viewer,
        ])
      )[0].allowed,
      false,
    );
    assert.equal(
      (
        await q(
          "update crm_leads set notes='Forbidden' where id=$1 returning id",
          [lead],
        )
      ).length,
      0,
    );
    await assert.rejects(
      q("select crm_set_member($1,'sales@test.invalid','admin')", [org]),
      /Admin/i,
    );
  });
  await as(sales, async () => {
    await assert.rejects(
      q(
        "insert into crm_leads(org_id,owner_id,name) values($1,$2,'Forged owner')",
        [org, admin],
      ),
      /row-level security/i,
    );
    await assert.rejects(
      q("update crm_leads set archived_at=now() where id=$1", [lead]),
      /Archive permission/i,
    );
    await assert.rejects(
      q("update org_members set role='admin' where org_id=$1 and user_id=$2", [
        org,
        sales,
      ]),
      /permission denied/i,
    );
  });
});
test("inbox API ingestion, duplicate guard and confirmed non-destructive merge", async () => {
  await as(admin, async () => {
    const payload = [
      {
        name: "Ada enquiry",
        company_name: "Analytical Engines",
        email: "ada@test.invalid",
        source_identifier: "enquiry-1",
        notes: "Second enquiry",
      },
    ];
    assert.equal(
      (
        await q("select crm_ingest($1,'Website',$2) as result", [
          org,
          JSON.stringify(payload),
        ])
      )[0].result.accepted,
      1,
    );
    assert.equal(
      (
        await q("select crm_ingest($1,'Website',$2) as result", [
          org,
          JSON.stringify(payload),
        ])
      )[0].result.duplicates_skipped,
      1,
    );
    const entry = (
      await q("select id from crm_inbox where org_id=$1", [org])
    )[0].id;
    await assert.rejects(
      q("select crm_accept_inbox($1)", [entry]),
      /duplicate/i,
    );
    assert.equal(
      (await q("select crm_accept_inbox($1,$2,true) as id", [entry, lead]))[0]
        .id,
      lead,
    );
    assert.equal(
      (await q("select email from crm_leads where id=$1", [lead]))[0].email,
      "ada@test.invalid",
    );
  });
});
test("workflows: AND conditions, actions, disabled rules, failure logs and loop suppression", async () => {
  await as(admin, async () => {
    await q(
      "insert into crm_workflows(org_id,name,enabled,trigger_type,conditions,actions) values($1,'Contact website enquiries',true,'lead_created',$2,$3)",
      [
        org,
        JSON.stringify([
          { field: "source", operator: "equals", value: "Website" },
        ]),
        JSON.stringify([
          {
            type: "create_task",
            title: "Contact new enquiry",
            due_minutes: 30,
          },
          { type: "add_tag", value: "website" },
          {
            type: "notification",
            title: "New website lead",
            value: "Contact promptly",
          },
        ]),
      ],
    );
    await q(
      'insert into crm_workflows(org_id,name,enabled,trigger_type,actions) values($1,\'Disabled\',false,\'lead_created\',\'[{"type":"create_task","title":"Must not exist"}]\')',
      [org],
    );
    await q(
      'insert into crm_workflows(org_id,name,enabled,trigger_type,actions) values($1,\'Invalid applicable action\',true,\'lead_created\',\'[{"type":"update_stage","value":"Not important"},{"type":"update_status","value":"INVALID"}]\')',
      [org],
    );
    await q(
      'insert into crm_workflows(org_id,name,enabled,trigger_type,actions) values($1,\'Update loop\',true,\'lead_updated\',\'[{"type":"add_tag","value":"loop_guard"}]\')',
      [org],
    );
    await q(
      "insert into crm_leads(org_id,owner_id,name,company_name,source) values($1,$2,'Workflow enquiry','Test company','Website')",
      [org, admin],
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from crm_activities where title='Contact new enquiry'",
        )
      )[0].n,
      1,
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from crm_activities where title='Must not exist'",
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from crm_workflow_executions where status='Failed'",
        )
      )[0].n,
      1,
    );
    await q(
      "insert into crm_leads(org_id,owner_id,name,source) values($1,$2,'Manual enquiry','Manual')",
      [org, admin],
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from crm_activities where title='Contact new enquiry'",
        )
      )[0].n,
      1,
    );
    const candidate = (
      await q("select id from crm_leads where name='Workflow enquiry'")
    )[0].id;
    await q("update crm_leads set priority='High' where id=$1", [candidate]);
    assert.ok(
      (
        await q("select tags from crm_leads where id=$1", [candidate])
      )[0].tags.includes("loop_guard"),
    );
  });
});
test("quotation relationship and Customer 360 timeline use original quotation IDs", async () => {
  await as(admin, async () => {
    await q(
      "insert into crm_quote_links(org_id,owner_id,account_id,contact_id,opportunity_id,preset_id,preset_name,quotation_id,values_snapshot) values($1,$2,$3,$4,$5,'preset-1','Project Quotation','QYR-TEST','{\"original-field\":\"Ada\"}')",
      [org, sales, account, contact, opportunity],
    );
    await q(
      "insert into tracked_quotes(org_id,created_by,token,quotation_id,preset_name,snapshot) values($1,$2,'test-token','QYR-TEST','Project Quotation','{\"values\":{\"original-field\":\"Ada\"}}')",
      [org, admin],
    );
    await q(
      "update tracked_quotes set status='approved' where token='test-token'",
    );
    assert.equal(
      (
        await q(
          "select status from crm_quote_links where quotation_id='QYR-TEST'",
        )
      )[0].status,
      "approved",
    );
    assert.ok(
      (
        await q(
          "select id from crm_events where account_id=$1 and event_type='quote_status_changed'",
          [account],
        )
      ).length > 0,
    );
    const metrics = (await q("select crm_metrics($1) as data", [org]))[0].data;
    assert.equal(Number(metrics.pipeline), 50000);
    assert.equal(Number(metrics.weighted_pipeline), 10000);
  });
  await as(null, async () => {
    const publicQuote = (
      await q("select get_tracked_quote('test-token') as quote")
    )[0].quote;
    assert.equal(publicQuote.org_id, undefined);
    assert.equal(publicQuote.account_id, undefined);
    assert.equal(publicQuote.snapshot.values["original-field"], "Ada");
  });
});
test("own/team/all visibility, server export denial, notification isolation and bounded pipeline query", async () => {
  const manager = (
    await q(
      "insert into auth.users(email) values('manager@test.invalid') returning id",
    )
  )[0].id;
  const colleague = (
    await q(
      "insert into auth.users(email) values('colleague@test.invalid') returning id",
    )
  )[0].id;
  const outside = (
    await q(
      "insert into auth.users(email) values('outside@test.invalid') returning id",
    )
  )[0].id;
  const team = (
    await q(
      "insert into crm_teams(org_id,name) values($1,'Sales A') returning id",
      [org],
    )
  )[0].id;
  await q(
    "insert into org_members(org_id,user_id,role,team_id) values($1,$2,'sales_manager',$5),($1,$3,'sales_user',$5),($1,$4,'sales_user',null)",
    [org, manager, colleague, outside, team],
  );
  await q("update org_members set team_id=$1 where org_id=$2 and user_id=$3", [
    team,
    org,
    sales,
  ]);
  const visible = (
    await q(
      "insert into crm_leads(org_id,owner_id,name) values($1,$2,'Team lead') returning id",
      [org, colleague],
    )
  )[0].id;
  const hidden = (
    await q(
      "insert into crm_leads(org_id,owner_id,name) values($1,$2,'Other team lead') returning id",
      [org, outside],
    )
  )[0].id;
  await as(manager, async () => {
    assert.equal(
      (await q("select id from crm_leads where id=$1", [visible])).length,
      1,
    );
    assert.equal(
      (await q("select id from crm_leads where id=$1", [hidden])).length,
      0,
    );
    await q("update crm_leads set priority='High' where id=$1", [visible]);
    assert.equal(
      (
        await q("select crm_export($1,$2,$3) as rows", [
          org,
          "leads",
          [visible],
        ])
      )[0].rows.length,
      1,
    );
  });
  await as(viewer, () =>
    assert.rejects(
      q("select crm_export($1,$2,$3)", [org, "leads", [visible]]),
      /Export permission/,
    ),
  );
  await as(sales, async () => {
    assert.equal(
      (await q("select id from crm_leads where id=$1", [visible])).length,
      0,
    );
    assert.ok(
      (await q("select crm_pipeline($1,'Discovery') as data", [org]))[0].data
        .rows.length <= 25,
    );
    const notification = (
      await q("select id from crm_notifications where user_id=$1 limit 1", [
        sales,
      ])
    )[0].id;
    await q(
      "update crm_notifications set read_at=now(),dismissed_at=now() where id=$1",
      [notification],
    );
    await assert.rejects(
      q("update crm_notifications set title='Forged' where id=$1", [
        notification,
      ]),
      /permission denied/,
    );
    assert.equal(
      (await q("select id from crm_notifications where user_id=$1", [outside]))
        .length,
      0,
    );
  });
  await as(stranger, async () => {
    assert.equal(
      (await q("select crm_account_summary($1) as summary", [account]))[0]
        .summary,
      null,
    );
    await assert.rejects(
      q("select crm_ingest($1,'Website','[{\"name\":\"Forbidden\"}]')", [org]),
      /permission/,
    );
  });
});
test("server validation, membership administration and workspace switching reject forged access", async () => {
  await as(sales, async () => {
    await assert.rejects(
      q(
        "insert into crm_activities(org_id,owner_id,title) values($1,$2,'Missing due date')",
        [org, sales],
      ),
      /due date/,
    );
    await assert.rejects(
      q("insert into org_members(org_id,user_id,role) values($1,$2,'admin')", [
        org,
        stranger,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      q("select crm_set_member($1,'sales@test.invalid','admin')", [org]),
      /Admin access/,
    );
    await assert.rejects(
      q("select crm_switch_workspace($1)", [otherOrg]),
      /Workspace unavailable/,
    );
  });
  const pending = (
    await q(
      "insert into auth.users(email) values('pending@test.invalid') returning id",
    )
  )[0].id;
  await as(admin, async () => {
    await assert.rejects(
      q("select crm_set_member($1,'pending@test.invalid','owner')", [org]),
      /Invalid assignable/,
    );
    await assert.rejects(
      q("select crm_set_member($1,'admin@test.invalid','viewer')", [org]),
      /Cannot change/,
    );
    await q("select crm_set_member($1,'pending@test.invalid','sales_user')", [
      org,
    ]);
  });
  await as(pending, async () => {
    await q("select crm_switch_workspace($1)", [org]);
    assert.equal(
      (await q("select default_org_id from profiles where id=$1", [pending]))[0]
        .default_org_id,
      org,
    );
  });
  await q(
    "insert into crm_notifications(org_id,user_id,title,dedupe_key) values($1,$2,'Test','removal-test')",
    [org, pending],
  );
  await as(admin, () =>
    q(
      "select crm_set_member($1,'pending@test.invalid','sales_user',null,true)",
      [org],
    ),
  );
  assert.equal(
    (
      await q(
        "select count(*)::int as n from crm_notifications where user_id=$1",
        [pending],
      )
    )[0].n,
    0,
  );
});
