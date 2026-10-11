import { runReminderCheck } from "@/lib/engine.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron (see vercel.json).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runReminderCheck());
}
