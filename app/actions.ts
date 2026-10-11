"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { simulateFailedRenewal, runReminderCheck } from "@/lib/engine.ts";

export async function startDemo() {
  const email = process.env.DEMO_EMAIL;
  if (!email) throw new Error("DEMO_EMAIL is not set");
  let error = "";
  try {
    await simulateFailedRenewal(email);
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }
  redirect(error ? `/?error=${encodeURIComponent(error)}` : "/dashboard?started=1");
}

export async function checkNow() {
  await runReminderCheck();
  revalidatePath("/dashboard");
}
