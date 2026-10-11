import { startDemo } from "./actions.ts";

export default function Home({ searchParams }: { searchParams: { error?: string } }) {
  const daySec = Number(process.env.RECOVERY_DAY_SECONDS ?? 86400);
  const demoTiming = daySec < 86400;
  return (
    <>
      <h1>Failed payments, recovered automatically</h1>
      <p className="lead">
        When a subscriber&apos;s card is declined, this system emails them a secure link to update it, follows up on
        day 3 and day 7, and stops the moment they pay. Nobody on the team has to chase it.
      </p>

      <div className="steps">
        <div className="card"><b>1. Card declined</b><span>Stripe reports the failed renewal to the system instantly.</span></div>
        <div className="card"><b>2. Instant email</b><span>The customer gets a link to update their card in one step.</span></div>
        <div className="card"><b>3. Day 3 and day 7</b><span>Reminders go out only if the invoice is still unpaid.</span></div>
        <div className="card"><b>4. Paid = stop</b><span>Payment cancels all remaining reminders and sends a thank-you.</span></div>
      </div>

      <h2>Try it</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          This creates a test subscriber whose renewal is declined. Watch it on the dashboard, then pay the invoice with
          Stripe&apos;s test card <b>4242 4242 4242 4242</b> (any future date, any CVC) to see it recovered.
        </p>
        {demoTiming && (
          <p className="note">Demo timing: one &quot;day&quot; is {daySec} seconds, so the full sequence plays out in minutes.</p>
        )}
        {searchParams.error && <div className="error">{searchParams.error}</div>}
        <form action={startDemo}><button type="submit">Simulate a failed renewal</button></form>
      </div>

      <h2>Built to be safe to run</h2>
      <ul className="clean">
        <li><b>Never sends the same email twice.</b> Each email has a unique key, so duplicate events from Stripe or a double click are ignored.</li>
        <li><b>Only trusts Stripe.</b> Every incoming event is checked against Stripe&apos;s signature before anything happens.</li>
        <li><b>Re-checks before acting.</b> The system reads the latest invoice from Stripe instead of trusting old event data, so a customer who just paid never gets a reminder.</li>
        <li><b>No extra database.</b> Recovery progress is stored on the Stripe invoice itself.</li>
      </ul>
    </>
  );
}
