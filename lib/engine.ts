import type Stripe from "stripe";
import { stripe, daySeconds } from "./stripe.ts";
import { sendRecoveryEmail } from "./email.ts";
import { nextDueStage, readStage, type Stage, type RecoveryState } from "./recovery.ts";

// The recovery state lives on the Stripe invoice itself (metadata), so the
// demo needs no separate database.

const nowSec = () => Math.floor(Date.now() / 1000);

function stateOf(inv: Stripe.Invoice): RecoveryState {
  const m = inv.metadata ?? {};
  return {
    invoiceStatus: inv.status ?? "draft",
    stage: readStage(m.recovery_stage),
    startedAt: m.recovery_started_at ? Number(m.recovery_started_at) : null,
    recoveredAt: m.recovered_at ? Number(m.recovered_at) : null,
  };
}

/** Sends the due email (if any) for one invoice, then records it on the invoice. */
async function advance(inv: Stripe.Invoice): Promise<Stage | null> {
  const state = stateOf(inv);
  const stage = nextDueStage(state, nowSec(), daySeconds());
  if (stage === null) return null;
  // Email first, record second. If recording fails, the retry hits Resend's
  // idempotency key and the email is not sent again.
  await sendRecoveryEmail(inv, stage);
  const t = String(nowSec());
  await stripe().invoices.update(inv.id!, {
    metadata: {
      recovery_stage: String(stage),
      recovery_started_at: state.startedAt ? String(state.startedAt) : t,
      [`email_${stage}_at`]: t,
    },
  });
  return stage;
}

/** Stripe says a payment failed. Always re-read the invoice: webhook data can be stale. */
export async function onPaymentFailed(invoiceId: string): Promise<void> {
  const inv = await stripe().invoices.retrieve(invoiceId);
  // Stripe's automatic retries fire this event again; the stage check makes those no-ops.
  if (readStage(inv.metadata?.recovery_stage) === 0) await advance(inv);
}

/** Stripe says an invoice was paid. If it was in recovery, mark it recovered. */
export async function onInvoicePaid(invoiceId: string): Promise<void> {
  const inv = await stripe().invoices.retrieve(invoiceId);
  const s = stateOf(inv);
  if (s.stage === 0 || s.recoveredAt) return; // never failed, or already handled
  await sendRecoveryEmail(inv, "recovered");
  await stripe().invoices.update(inv.id!, { metadata: { recovered_at: String(nowSec()) } });
}

/** Finds invoices in recovery and sends any reminders that are now due. */
export async function runReminderCheck(): Promise<{ checked: number; sent: number }> {
  let checked = 0;
  let sent = 0;
  for await (const inv of stripe().invoices.list({ status: "open", limit: 100 })) {
    if (readStage(inv.metadata?.recovery_stage) === 0) continue;
    checked++;
    try {
      if ((await advance(inv)) !== null) sent++;
    } catch (err) {
      console.error(`Reminder failed for ${inv.id}`, err); // keep going with the rest
    }
  }
  return { checked, sent };
}

export interface RecoveryRow {
  id: string;
  amount: number;
  currency: string;
  status: "recovering" | "recovered" | "unrecovered";
  stage: Stage;
  startedAt: number;
  recoveredAt: number | null;
  emails: { stage: number; at: number }[];
  payUrl: string | null;
}

export async function listRecoveries(): Promise<RecoveryRow[]> {
  const rows: RecoveryRow[] = [];
  const since = nowSec() - 60 * 24 * 3600;
  for await (const inv of stripe().invoices.list({ created: { gte: since }, limit: 100 })) {
    const s = stateOf(inv);
    if (s.stage === 0) continue;
    const m = inv.metadata ?? {};
    rows.push({
      id: inv.id!,
      amount: s.recoveredAt ? inv.amount_paid : inv.amount_due,
      currency: inv.currency,
      status: s.recoveredAt || inv.status === "paid" ? "recovered" : inv.status === "open" ? "recovering" : "unrecovered",
      stage: s.stage,
      startedAt: s.startedAt ?? inv.created,
      recoveredAt: s.recoveredAt,
      emails: [1, 2, 3].filter((n) => m[`email_${n}_at`]).map((n) => ({ stage: n, at: Number(m[`email_${n}_at`]) })),
      payUrl: inv.status === "open" ? inv.hosted_invoice_url ?? null : null,
    });
    if (rows.length >= 50) break;
  }
  return rows;
}

/**
 * Creates a realistic failed renewal in Stripe test mode: a customer subscribes
 * with a working card, their card then starts declining, and the next billing
 * cycle is charged immediately and fails.
 */
export async function simulateFailedRenewal(email: string): Promise<void> {
  const s = stripe();
  // Simple abuse guard: one simulation per 2 minutes.
  const recent = await s.customers.list({ created: { gte: nowSec() - 120 }, limit: 10 });
  if (recent.data.some((c) => c.metadata?.demo === "true")) {
    throw new Error("A demo was started in the last 2 minutes. Please wait a moment and try again.");
  }

  const prices = await s.prices.list({ lookup_keys: ["demo_monthly_membership"], limit: 1 });
  const price =
    prices.data[0] ??
    (await s.prices.create({
      currency: "cad",
      unit_amount: 2900,
      recurring: { interval: "month" },
      lookup_key: "demo_monthly_membership",
      product_data: { name: "Student Membership (demo)" },
    }));

  const customer = await s.customers.create({ email, name: "Demo Student", metadata: { demo: "true" } });
  // Stripe's built-in test cards: one that works, one that attaches but declines charges.
  const good = await s.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await s.customers.update(customer.id, { invoice_settings: { default_payment_method: good.id } });
  const sub = await s.subscriptions.create({ customer: customer.id, items: [{ price: price.id }] });

  const bad = await s.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customer.id });
  await s.customers.update(customer.id, { invoice_settings: { default_payment_method: bad.id } });
  try {
    // Bill the next cycle now. The charge fails, Stripe sends invoice.payment_failed.
    await s.subscriptions.update(sub.id, { billing_cycle_anchor: "now", proration_behavior: "none" });
  } catch (err) {
    // A card decline here is the expected outcome; anything else is a real error.
    if ((err as { type?: string }).type !== "StripeCardError") throw err;
  }
}
