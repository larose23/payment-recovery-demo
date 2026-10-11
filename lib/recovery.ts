// Pure decision logic for the recovery sequence. No network calls here,
// so it can be unit tested on its own.

export type Stage = 0 | 1 | 2 | 3;

export const SEQUENCE: { stage: Exclude<Stage, 0>; afterDays: number; label: string }[] = [
  { stage: 1, afterDays: 0, label: "Payment failed notice" },
  { stage: 2, afterDays: 3, label: "Day 3 reminder" },
  { stage: 3, afterDays: 7, label: "Day 7 final notice" },
];

export interface RecoveryState {
  invoiceStatus: string; // Stripe invoice status: open, paid, void, uncollectible, draft
  stage: Stage; // last email sent (0 = none yet)
  startedAt: number | null; // unix seconds of first failure
  recoveredAt: number | null;
}

export function readStage(value: string | undefined): Stage {
  const n = Number(value ?? 0);
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

/**
 * Returns the next email stage that is due, or null if nothing should be sent.
 * Sends at most one step per check, so a late check never fires two emails at once.
 */
export function nextDueStage(state: RecoveryState, now: number, daySeconds: number): Stage | null {
  if (state.invoiceStatus !== "open") return null; // paid, voided or written off: stop
  if (state.recoveredAt) return null;
  if (state.stage === 0) return 1; // first failure: notify immediately
  if (state.startedAt === null) return null;
  const step = SEQUENCE.find((s) => s.stage === state.stage + 1);
  if (!step) return null; // sequence finished
  const elapsed = now - state.startedAt;
  return elapsed >= step.afterDays * daySeconds ? step.stage : null;
}

/** Key that makes the email provider drop exact repeats of the same email. */
export function emailKey(invoiceId: string, stage: Stage | "recovered"): string {
  return `recovery-${invoiceId}-${stage}`;
}
