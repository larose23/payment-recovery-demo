import type Stripe from "stripe";
import { stripe } from "@/lib/stripe.ts";
import { onPaymentFailed, onInvoicePaid } from "@/lib/engine.ts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    // Rejects anything that didn't really come from Stripe.
    event = stripe().webhooks.constructEvent(body, sig ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const inv = event.data.object as Stripe.Invoice;
    if (event.type === "invoice.payment_failed") await onPaymentFailed(inv.id!);
    if (event.type === "invoice.paid") await onInvoicePaid(inv.id!);
  } catch (err) {
    console.error(`Webhook ${event.type} ${event.id} failed`, err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  return Response.json({ received: true });
}
