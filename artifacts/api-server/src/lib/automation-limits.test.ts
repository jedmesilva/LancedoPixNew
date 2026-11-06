import assert from "node:assert/strict";
import test from "node:test";
import {
  exceedsAutomationCap,
  hasInconsistentAutomationCaps,
  reachedAutomationCountCap,
} from "./automation-limits";

test("zero means an unset, unlimited automation cap", () => {
  assert.equal(
    hasInconsistentAutomationCaps({
      maxBidCents: 0,
      perDisputeLimitCents: 0n,
      dailyLimitCents: 0,
    }),
    false,
  );
  assert.equal(exceedsAutomationCap(0n, 10_000n), false);
  assert.equal(reachedAutomationCountCap(0, 100), false);
});

test("only configured monetary caps must be in ascending order", () => {
  assert.equal(
    hasInconsistentAutomationCaps({
      maxBidCents: 500,
      perDisputeLimitCents: 0n,
      dailyLimitCents: 1_000,
    }),
    false,
  );
  assert.equal(
    hasInconsistentAutomationCaps({
      maxBidCents: 0n,
      perDisputeLimitCents: 2_000,
      dailyLimitCents: 1_000,
    }),
    true,
  );
  assert.equal(
    hasInconsistentAutomationCaps({
      maxBidCents: 1_000n,
      perDisputeLimitCents: 500,
      dailyLimitCents: 0n,
    }),
    true,
  );
});

test("positive amount and count caps still stop spending at their limits", () => {
  assert.equal(exceedsAutomationCap(500n, 501n), true);
  assert.equal(exceedsAutomationCap(500n, 500n), false);
  assert.equal(reachedAutomationCountCap(3, 3), true);
  assert.equal(reachedAutomationCountCap(3, 2), false);
});
