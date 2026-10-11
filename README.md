# Payment Recovery Demo

Automatic failed-payment recovery for subscription businesses, built on **Stripe** and **Resend**.

When a subscriber's renewal is declined, the system:

1. Emails them right away with a secure link to update their card
2. Sends a reminder on day 3 and a final notice on day 7, but only while the invoice is still unpaid
3. Stops all reminders the moment they pay, and sends a thank-you
4. Shows every failed payment, each email sent, and the revenue recovered on a dashboard

**Live demo:** _link added after deployment_

## Why it's built this way

| Concern | How it's handled |
|---|---|
| Duplicate emails | Every email carries an idempotency key (invoice + step). Stripe resends events and buttons get double-clicked; the email provider drops the repeat. |
| Fake requests | Every webhook is verified against Stripe's signature before anything runs. |
| Stale data | Handlers re-read the invoice from Stripe instead of trusting the event payload, so someone who just paid never gets a reminder. |
| Late or missed checks | A check sends at most one step, so a delayed run never fires two emails at once. |
| Failures | If an email fails, the webhook returns an error and Stripe retries. One bad invoice never stops the daily check for the rest. |
| Extra infrastructure | Recovery progress is stored in the Stripe invoice's metadata. No separate database. |
| Safety | The app refuses to start with a live Stripe key. Test mode only. |

## How it works

```
Stripe: renewal declined ──webhook──▶ /api/webhooks/stripe ──▶ email 1 (immediately)
Vercel Cron, daily ─────────────────▶ /api/cron ──────────────▶ email 2 (day 3), email 3 (day 7)
Stripe: invoice paid ─────webhook──▶ /api/webhooks/stripe ──▶ mark recovered, thank-you email
```

The sequence logic lives in [`lib/recovery.ts`](lib/recovery.ts) and is covered by unit tests in [`tests/`](tests/). Stripe and email calls are in [`lib/engine.ts`](lib/engine.ts) and [`lib/email.ts`](lib/email.ts).

## Try it

On the live demo, click **Simulate a failed renewal**. This creates a test subscriber in Stripe whose card is declined on renewal. Open the dashboard, then click **Pay as customer** and pay with Stripe's test card `4242 4242 4242 4242` to watch the invoice move to recovered.

In demo mode one "day" is shortened to 60 seconds, so the full sequence plays out in minutes. Use **Run reminder check now** to trigger the reminder check on demand.

## Built with

Next.js 14 · TypeScript · Stripe API (test mode) · Resend · Vercel (hosting and cron)

## Run it yourself

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Stripe test key, Resend key, and `DEMO_EMAIL`
3. In Stripe, add a webhook to `https://<your-site>/api/webhooks/stripe` for `invoice.payment_failed` and `invoice.paid`
4. `npm run dev`, and `npm test` for the unit tests

Built by Zakariya Mahadalle with AI-assisted development.
