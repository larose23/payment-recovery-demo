import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDueStage, readStage, emailKey } from "../lib/recovery.ts";

const DAY = 60;
const base = { invoiceStatus: "open", stage: 0 as const, startedAt: null, recoveredAt: null };

test("first failure sends the first email right away", () => {
  assert.equal(nextDueStage(base, 1000, DAY), 1);
});

test("day 3 reminder waits until 3 days have passed", () => {
  const s = { ...base, stage: 1 as const, startedAt: 1000 };
  assert.equal(nextDueStage(s, 1000 + 3 * DAY - 1, DAY), null);
  assert.equal(nextDueStage(s, 1000 + 3 * DAY, DAY), 2);
});

test("day 7 final notice waits until 7 days have passed", () => {
  const s = { ...base, stage: 2 as const, startedAt: 1000 };
  assert.equal(nextDueStage(s, 1000 + 7 * DAY - 1, DAY), null);
  assert.equal(nextDueStage(s, 1000 + 7 * DAY, DAY), 3);
});

test("a late check sends only one step, never two at once", () => {
  const s = { ...base, stage: 1 as const, startedAt: 1000 };
  assert.equal(nextDueStage(s, 1000 + 30 * DAY, DAY), 2);
});

test("nothing after the final notice", () => {
  const s = { ...base, stage: 3 as const, startedAt: 1000 };
  assert.equal(nextDueStage(s, 1000 + 99 * DAY, DAY), null);
});

test("paid, voided or recovered invoices get no more emails", () => {
  for (const invoiceStatus of ["paid", "void", "uncollectible"]) {
    assert.equal(nextDueStage({ ...base, invoiceStatus }, 1000, DAY), null);
  }
  assert.equal(nextDueStage({ ...base, stage: 1, startedAt: 1, recoveredAt: 5 }, 1e9, DAY), null);
});

test("junk metadata is treated as no emails sent", () => {
  assert.equal(readStage(undefined), 0);
  assert.equal(readStage("banana"), 0);
  assert.equal(readStage("2"), 2);
});

test("email keys are stable per invoice and stage", () => {
  assert.equal(emailKey("in_1", 2), emailKey("in_1", 2));
  assert.notEqual(emailKey("in_1", 2), emailKey("in_1", 3));
});
