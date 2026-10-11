import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!key.startsWith("sk_test_")) {
      throw new Error("This demo only runs with a Stripe TEST key (sk_test_...)");
    }
    // STRIPE_API_HOST is only for local testing against a fake Stripe server.
    const host = process.env.STRIPE_API_HOST;
    client = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      ...(host ? { host, port: Number(process.env.STRIPE_API_PORT ?? 80), protocol: "http" as const } : {}),
    });
  }
  return client;
}

export function daySeconds(): number {
  const n = Number(process.env.RECOVERY_DAY_SECONDS ?? 86400);
  return Number.isFinite(n) && n > 0 ? n : 86400;
}
