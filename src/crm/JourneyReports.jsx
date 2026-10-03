import { useState } from "react";
import { useQuery } from "./useQuery";
import { dayBounds } from "./journeyService";
import { money } from "./schema";
import { stageLabel } from "./brain";
import { PageHeader, Skeleton } from "./JourneyUI";
import ManagementDashboard from "./ManagementDashboard";
export default function JourneyReports({ env, go }) {
  const [advanced, setAdvanced] = useState(false);
  const [bounds] = useState(dayBounds);
  const data = useQuery("crm_journey_home", {
    p_org: env.user.orgId,
    ...bounds,
  });
  if (advanced)
    return (
      <>
        <button className="btn btn-soft" onClick={() => setAdvanced(false)}>
          Back to business snapshot
        </button>
        <ManagementDashboard env={env} go={go} reports />
      </>
    );
  const stats = data.data;
  const openStages = (stats?.stages || []).filter(
    (row) => !["Won", "Lost"].includes(row.stage),
  );
  const lostTotal = (stats?.lost_reasons || []).reduce(
    (sum, row) => sum + Number(row.count),
    0,
  );
  return (
    <div className="screen screen-wide">
      <PageHeader
        title="Business snapshot"
        subtitle="How your business is moving, and where to focus next."
      >
        <button className="btn btn-soft" onClick={() => setAdvanced(true)}>
          Advanced reports
        </button>
      </PageHeader>
      {data.error && <p className="alert alert-error">{data.error}</p>}
      {data.loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="journey-kpis report-kpis">
            {[
              ["Open pipeline · INR", money(stats?.pipeline)],
              ["Won this month · INR", money(stats?.won_month)],
              [
                "Enquiry → won",
                `${stats?.enquiries ? Math.round((stats.won_leads / stats.enquiries) * 100) : 0}%`,
              ],
              [
                "Average closing time",
                stats?.average_close_days == null
                  ? "—"
                  : `${stats.average_close_days} days`,
              ],
              ["Quotes awaiting decision", stats?.quotes_waiting || 0],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="journey-report-grid">
            <section>
              <h2>Where are deals getting stuck?</h2>
              <p>Open deals by stage.</p>
              {openStages.map((row) => (
                <div className="report-bar-row" key={row.stage}>
                  <span>{stageLabel(row.stage)}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(3, (Number(row.count) / Math.max(1, ...openStages.map((item) => Number(item.count)))) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {!openStages.length && (
                <p>No open deals. Your active pipeline will appear here.</p>
              )}
            </section>
            <section>
              <h2>Why are we losing business?</h2>
              <p>Recorded reasons from closed deals.</p>
              {stats?.lost_reasons?.map((row) => (
                <div className="report-bar-row" key={row.reason}>
                  <span>{row.reason}</span>
                  <div>
                    <i
                      style={{
                        width: `${(Number(row.count) / Math.max(1, lostTotal)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {Math.round(
                      (Number(row.count) / Math.max(1, lostTotal)) * 100,
                    )}
                    %
                  </strong>
                </div>
              ))}
              {!lostTotal && <p>No lost reasons recorded yet.</p>}
            </section>
          </div>
          <p className="form-hint">
            Pipeline and won values use INR. Other currencies and historical
            date filters are available in advanced reports. Conversion counts
            linked enquiries won; it does not treat all new customers as
            enquiries.
          </p>
        </>
      )}
    </div>
  );
}
