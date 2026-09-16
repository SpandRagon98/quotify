import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { getRecord, rpc } from "./service";
import { ENTITIES, displayName, money } from "./schema";
import RecordForm from "./RecordForm";
import RecordList, { Badge } from "./RecordList";
import Timeline from "./Timeline";
import ConversionDialog from "./ConversionDialog";
import InboxReview from "./InboxReview";
import DocumentPreview from "../components/common/DocumentPreview";
import { useCompanyProfile } from "../hooks/useCompanyProfile";
import { safeDocumentUrl } from "./helpers";
function LinkedDocument({ record, preset }) {
  const cfg = useCompanyProfile(record.preset_id);
  return (
    <>
      <p className="form-hint">
        Saved CRM snapshot. Edit the original quotation through Sales →
        Quotations to fetch the latest Google Sheet row.
      </p>
      <DocumentPreview
        preset={preset}
        values={record.values_snapshot}
        quotationId={record.quotation_id}
        logo={cfg.logo}
        banner={cfg.banner}
        description={cfg.description}
        hiddenFields={cfg.hiddenFields}
        extraContent={cfg.extraContent}
      />
    </>
  );
}
export default function RecordDetail({
  entity,
  id,
  env,
  go,
  presets,
  onCreateQuote,
}) {
  const [record, setRecord] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(null);
  const [convert, setConvert] = useState(false);
  const reload = () => setRevision((n) => n + 1);
  useEffect(() => {
    let active = true;
    Promise.all([
      getRecord(entity, env.user.orgId, id),
      entity === "accounts"
        ? rpc("crm_account_summary", { p_account: id })
        : Promise.resolve(null),
    ])
      .then(([row, stats]) => {
        if (active) {
          setRecord(row);
          setSummary(stats);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [entity, id, env.user.orgId, revision]);
  const definition = ENTITIES[entity];
  const cap =
    env.access[entity === "quote_links" ? "quotations" : entity] || {};
  if (error)
    return (
      <div className="screen">
        <div className="alert alert-error">{error}</div>
        <button
          className="btn btn-soft"
          onClick={() => go(entity === "quote_links" ? "database" : entity)}
        >
          Back
        </button>
        <button className="btn btn-soft" onClick={reload}>
          Retry
        </button>
      </div>
    );
  if (!record)
    return <div className="screen empty-inline">Loading record…</div>;
  const owner =
    env.members.find((m) => m.id === record.owner_id)?.name || "Member";
  const accountId =
    entity === "accounts"
      ? id
      : record.account_id || record.converted_account_id;
  const context = {
    owner_id: record.owner_id,
    account_id: accountId,
    contact_id:
      entity === "contacts"
        ? id
        : record.contact_id || record.converted_contact_id,
    opportunity_id:
      entity === "opportunities"
        ? id
        : record.opportunity_id || record.converted_opportunity_id,
    lead_id: entity === "leads" ? id : record.lead_id,
    currency: record.currency || "INR",
  };
  const activityDefaults = { ...context, owner_id: record.owner_id };
  const createActivity = (type) =>
    setForm({
      entity: "activities",
      record: {
        ...activityDefaults,
        title: `${type}: ${displayName(entity, record)}`,
        activity_type: type,
        ...(type === "Note" ? { status: "Completed" } : {}),
      },
    });
  const timelineRelated =
    entity === "accounts"
      ? { account_id: id }
      : entity === "leads"
        ? { lead_id: id }
        : entity === "opportunities"
          ? { opportunity_id: id }
          : entity === "contacts"
            ? { contact_id: id }
            : { entity_id: id };
  const tabs = (
    entity === "accounts"
      ? [
          "Overview",
          "Contacts",
          "Opportunities",
          "Activities",
          "Quotations",
          "Documents",
          "Notes",
        ]
      : ["Overview", "Activities", "Quotations", "Documents", "Notes"]
  ).filter(
    (name) =>
      name === "Overview" ||
      (name === "Contacts"
        ? env.access.contacts?.view
        : name === "Opportunities"
          ? env.access.opportunities?.view
          : ["Activities", "Notes"].includes(name)
            ? env.access.activities?.view
            : env.access.quotations?.view),
  );
  const relation =
    entity === "accounts"
      ? { account_id: id }
      : entity === "leads"
        ? { lead_id: id }
        : entity === "opportunities"
          ? { opportunity_id: id }
          : entity === "contacts"
            ? { contact_id: id }
            : { account_id: accountId };
  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div className="head-with-back">
          <button
            className="icon-btn"
            title="Back"
            onClick={() => go(entity === "quote_links" ? "database" : entity)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="screen-title">{displayName(entity, record)}</h1>
            <p className="screen-sub">
              {definition.singular} · {owner} ·{" "}
              {[record.industry, record.city, record.state]
                .filter(Boolean)
                .join(", ")}{" "}
              ·{" "}
              <Badge>
                {record.status ||
                  record.stage ||
                  record.account_type ||
                  "Active"}
              </Badge>
            </p>
          </div>
        </div>
        <div className="head-actions">
          {cap.edit && entity !== "quote_links" && (
            <button
              className="btn btn-soft"
              onClick={() => setForm({ entity, record })}
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {entity === "leads" && cap.edit && !record.converted_at && (
            <button
              className="btn btn-primary"
              onClick={() => setConvert(true)}
            >
              Convert lead
            </button>
          )}
          {accountId && entity !== "accounts" && (
            <button
              className="btn btn-soft"
              onClick={() =>
                go("crm_record", { entity: "accounts", id: accountId })
              }
            >
              Customer 360
            </button>
          )}
          {env.access.quotations?.create && accountId && (
            <button
              className="btn btn-primary"
              onClick={() => onCreateQuote(context)}
            >
              Create quotation
            </button>
          )}
        </div>
      </header>
      {summary && (
        <p className="screen-sub">
          Main contact:{" "}
          {summary.primary_contact
            ? [
                summary.primary_contact.name,
                summary.primary_contact.email,
                summary.primary_contact.phone,
              ]
                .filter(Boolean)
                .join(" · ")
            : "No primary contact selected"}
        </p>
      )}
      {summary && (
        <div className="crm-kpis">
          {[
            ["Contacts", summary.contacts],
            ["Opportunities", summary.opportunities],
            ["Quotations", summary.quotations],
            ["Outstanding activities", summary.open_activities],
          ].map(([label, value]) => (
            <div className="card" key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
          {summary.values?.map((v) => (
            <div className="card" key={v.currency}>
              <small>Pipeline / Won deal value · {v.currency}</small>
              <strong>{money(v.pipeline, v.currency)}</strong>
              <span>{money(v.won, v.currency)} won</span>
            </div>
          ))}
        </div>
      )}
      {env.access.activities?.create && entity !== "quote_links" && (
        <div className="crm-tab-actions">
          {["Task", "Call", "Meeting", "Follow-up", "Note"].map((type) => (
            <button
              className="btn btn-soft"
              key={type}
              onClick={() => createActivity(type)}
            >
              <Plus size={14} />
              {type}
            </button>
          ))}
          {entity === "accounts" && env.access.contacts?.create && (
            <button
              className="btn btn-soft"
              onClick={() =>
                setForm({
                  entity: "contacts",
                  record: { account_id: id, owner_id: record.owner_id },
                })
              }
            >
              Add contact
            </button>
          )}
          {entity === "accounts" && env.access.opportunities?.create && (
            <button
              className="btn btn-soft"
              onClick={() =>
                setForm({
                  entity: "opportunities",
                  record: { account_id: id, owner_id: record.owner_id },
                })
              }
            >
              Create opportunity
            </button>
          )}
        </div>
      )}
      {entity === "inbox" && cap.edit && (
        <InboxReview {...{ record, env, go, reload }} />
      )}
      {entity === "quote_links" ? (
        <div className="card">
          {safeDocumentUrl(record.doc_url) && (
            <a
              className="btn btn-soft"
              href={safeDocumentUrl(record.doc_url)}
              target="_blank"
              rel="noreferrer"
            >
              Open generated document
            </a>
          )}
          <button
            className="btn btn-soft"
            onClick={() =>
              go("database", {
                presetId: record.preset_id,
                initialQuery: record.quotation_id,
              })
            }
          >
            Open original in Quotations
          </button>
          {presets.find((p) => p.id === record.preset_id) ? (
            <LinkedDocument
              record={record}
              preset={presets.find((p) => p.id === record.preset_id)}
            />
          ) : (
            <p>
              This preset is no longer available. The saved CRM snapshot and
              original sheet record are preserved.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="crm-tabs" role="tablist">
            {tabs.map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                className={`btn ${tab === name ? "btn-primary" : "btn-soft"}`}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <div className="crm-detail-grid">
              <div className="card">
                <h3 className="card-title">Record details</h3>
                <dl className="crm-detail-fields">
                  {definition.fields
                    .filter(
                      (f) =>
                        !["notes", "description"].includes(f.key) &&
                        record[f.key] != null &&
                        record[f.key] !== "",
                    )
                    .map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>
                          {f.type === "owner" ? (
                            owner
                          ) : f.type === "relation" ? (
                            <button
                              className="crm-record-link"
                              onClick={() =>
                                go("crm_record", {
                                  entity: f.entity,
                                  id: record[f.key],
                                })
                              }
                            >
                              Open {f.label.toLowerCase()}
                            </button>
                          ) : f.type === "checkbox" ? (
                            record[f.key] ? (
                              "Yes"
                            ) : (
                              "No"
                            )
                          ) : Array.isArray(record[f.key]) ? (
                            record[f.key].join(", ")
                          ) : (
                            String(record[f.key])
                          )}
                        </dd>
                      </div>
                    ))}
                  <div>
                    <dt>Created / Updated</dt>
                    <dd>
                      {new Date(record.created_at).toLocaleString()} /{" "}
                      {new Date(record.updated_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Record ID</dt>
                    <dd>{record.id}</dd>
                  </div>
                </dl>
                {record.notes && (
                  <p className="crm-preserve-lines">{record.notes}</p>
                )}
                {record.description && (
                  <p className="crm-preserve-lines">{record.description}</p>
                )}
              </div>
              <Timeline env={env} related={timelineRelated} key={revision} />
            </div>
          )}
          {tab === "Contacts" && (
            <RecordList
              entity="contacts"
              env={env}
              go={go}
              related={{ account_id: id }}
              embedded
              initialRecord={{ owner_id: record.owner_id }}
            />
          )}
          {tab === "Opportunities" && (
            <RecordList
              entity="opportunities"
              env={env}
              go={go}
              related={{ account_id: id }}
              embedded
              initialRecord={{ owner_id: record.owner_id }}
            />
          )}
          {tab === "Activities" && (
            <RecordList
              entity="activities"
              env={env}
              go={go}
              related={relation}
              embedded
              initialRecord={activityDefaults}
            />
          )}
          {(tab === "Quotations" || tab === "Documents") && accountId && (
            <RecordList
              entity="quote_links"
              env={env}
              go={go}
              related={
                entity === "leads" ? { account_id: accountId } : relation
              }
              embedded
              onCreateQuote={() => onCreateQuote(context)}
            />
          )}
          {(tab === "Quotations" || tab === "Documents") && !accountId && (
            <div className="empty-state">
              Convert this lead to link quotations and their documents to a
              customer account.
            </div>
          )}
          {tab === "Notes" && (
            <>
              <div className="card">
                <h3 className="card-title">Internal notes</h3>
                <p className="crm-preserve-lines">
                  {record.notes || "No record notes yet."}
                </p>
              </div>
              <RecordList
                entity="activities"
                env={env}
                go={go}
                related={{ ...relation, activity_type: "Note" }}
                embedded
                initialRecord={{
                  ...activityDefaults,
                  activity_type: "Note",
                  status: "Completed",
                }}
              />
            </>
          )}
        </>
      )}
      {form && (
        <RecordForm
          key={`${form.entity}:${form.record.id || "new"}`}
          {...form}
          env={env}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
      {convert && (
        <ConversionDialog
          lead={record}
          env={env}
          onClose={() => setConvert(false)}
          onConverted={(result) => {
            setConvert(false);
            go("crm_record", { entity: "accounts", id: result.account_id });
          }}
        />
      )}
    </div>
  );
}
