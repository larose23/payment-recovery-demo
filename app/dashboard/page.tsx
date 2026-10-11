import { listRecoveries } from "@/lib/engine.ts";
import { SEQUENCE } from "@/lib/recovery.ts";
import { checkNow } from "../actions.ts";

export const dynamic = "force-dynamic";

const fmtMoney = (cents: number, cur: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
const fmtTime = (s: number) =>
  new Date(s * 1000).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
const label = (stage: number) => SEQUENCE.find((s) => s.stage === stage)?.label ?? `Email ${stage}`;

export default async function Dashboard({ searchParams }: { searchParams: { started?: string } }) {
  let rows: Awaited<ReturnType<typeof listRecoveries>> = [];
  let error = "";
  try {
    rows = await listRecoveries();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load data from Stripe";
  }
  const recovered = rows.filter((r) => r.status === "recovered");
  const pending = rows.filter((r) => r.status === "recovering");
  const cur = rows[0]?.currency ?? "cad";
  const recoveredAmt = recovered.reduce((a, r) => a + r.amount, 0);
  const rate = rows.length ? Math.round((recovered.length / rows.length) * 100) : 0;

  return (
    <>
      <h1>Recovery dashboard</h1>
      {searchParams.started && (
        <div className="success">
          Test renewal created and declined. The first email goes out within a few seconds. Refresh to see it appear.
        </div>
      )}
      {error && <div className="error">{error}</div>}

      <div className="stats">
        <div className="card stat"><div className="n">{rows.length}</div><div className="l">Failed payments</div></div>
        <div className="card stat"><div className="n">{recovered.length}</div><div className="l">Recovered</div></div>
        <div className="card stat"><div className="n">{pending.length}</div><div className="l">Still recovering</div></div>
        <div className="card stat"><div className="n">{fmtMoney(recoveredAmt, cur)}</div><div className="l">Revenue recovered ({rate}%)</div></div>
      </div>

      <form action={checkNow} style={{ marginBottom: 16 }}>
        <button className="secondary" type="submit">Run reminder check now</button>
        <span className="note" style={{ marginLeft: 10 }}>Runs automatically once a day. Use this to skip ahead in the demo.</span>
      </form>

      <div className="tablewrap">
        <table>
          <thead><tr><th>Invoice</th><th>Amount</th><th>Status</th><th>Emails sent</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="note">No failed payments yet. Start one from the home page.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code>{r.id.slice(-10)}</code><div className="note">Failed {fmtTime(r.startedAt)}</div></td>
                <td>{fmtMoney(r.amount, r.currency)}</td>
                <td>
                  <span className={`pill ${r.status}`}>{r.status}</span>
                  {r.recoveredAt && <div className="note">Paid {fmtTime(r.recoveredAt)}</div>}
                </td>
                <td>{r.emails.map((e) => <div key={e.stage}>{label(e.stage)} <span className="note">· {fmtTime(e.at)}</span></div>)}</td>
                <td>{r.payUrl && <a className="btn" href={r.payUrl} target="_blank" rel="noreferrer">Pay as customer</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
