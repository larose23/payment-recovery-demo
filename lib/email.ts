import type Stripe from "stripe";
import type { Stage } from "./recovery.ts";
import { emailKey } from "./recovery.ts";

function money(inv: Stripe.Invoice): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: inv.currency.toUpperCase() })
    .format(inv.amount_due / 100);
}

function content(inv: Stripe.Invoice, stage: Stage | "recovered") {
  const amount = money(inv);
  const link = inv.hosted_invoice_url ?? "";
  const button = `<p><a href="${link}" style="background:#1f3a5f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Update payment</a></p>`;
  switch (stage) {
    case 1:
      return {
        subject: "Your payment didn't go through",
        html: `<p>Hi,</p><p>We tried to charge ${amount} for your membership, but the payment was declined. This usually happens when a card expires or hits its limit.</p>${button}<p>Your access stays on for now. Updating takes about a minute.</p>`,
      };
    case 2:
      return {
        subject: "Reminder: your membership payment is still pending",
        html: `<p>Hi,</p><p>Just a reminder that your ${amount} payment is still outstanding.</p>${button}<p>If you've already sorted it, you can ignore this.</p>`,
      };
    case 3:
      return {
        subject: "Final notice: your membership will be paused",
        html: `<p>Hi,</p><p>We still haven't been able to collect ${amount}. If the payment isn't updated soon, your membership will be paused.</p>${button}`,
      };
    case "recovered":
      return {
        subject: "Payment received, you're all set",
        html: `<p>Hi,</p><p>Thanks, we received your payment of ${money({ ...inv, amount_due: inv.amount_paid })}. Your membership is active. No further action needed.</p>`,
      };
    default:
      throw new Error(`No email for stage ${stage}`);
  }
}

/**
 * Sends one email through Resend. The Idempotency-Key header makes Resend
 * ignore a repeat of the same email (same invoice and stage), so a duplicate
 * webhook or a double-clicked button can never send it twice.
 */
export async function sendRecoveryEmail(inv: Stripe.Invoice, stage: Stage | "recovered"): Promise<void> {
  const to = inv.customer_email;
  if (!to) throw new Error(`Invoice ${inv.id} has no customer email`);
  const { subject, html } = content(inv, stage);
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": emailKey(inv.id!, stage),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Payment Recovery Demo <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  }
}
