import assert from "node:assert/strict";
import test from "node:test";
import {
  BONUS_POLICY,
  calculateBonusBudget,
  calculateBonusNeedScoreBps,
  type BonusPolicyMetrics,
} from "./bonus-policy.js";

const baseMetrics: BonusPolicyMetrics = {
  idleSeconds: 0,
  recentBidCount: BONUS_POLICY.targetBidsPerWindow,
  averageBidCents: 1_000n,
  minimumStepCents: 10n,
  prizeCents: 100_000n,
};

test("does not unlock bonus until the dispute's prize is covered", () => {
  const result = calculateBonusBudget({
    bidRevenueCents: 99_999n,
    prizeDebtCents: 100_000n,
    alreadyReservedCents: 0n,
    metrics: baseMetrics,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.additionalBonusCents, 0n);
});

test("idle periods, low frequency, and small bids increase the incentive score", () => {
  const active = calculateBonusNeedScoreBps(baseMetrics);
  const quiet = calculateBonusNeedScoreBps({
    idleSeconds: 40,
    recentBidCount: 0,
    averageBidCents: 10n,
    minimumStepCents: 10n,
    prizeCents: 100_000n,
  });

  assert.ok(quiet > active);
});

test("bonus target never exceeds 10% of the dispute's own surplus", () => {
  const result = calculateBonusBudget({
    bidRevenueCents: 200_000n,
    prizeDebtCents: 100_000n,
    alreadyReservedCents: 0n,
    metrics: {
      idleSeconds: 60,
      recentBidCount: 0,
      averageBidCents: 10n,
      minimumStepCents: 10n,
      prizeCents: 100_000n,
    },
  });

  assert.equal(result.freeBalanceCents, 100_000n);
  assert.equal(result.maximumBonusCents, 10_000n);
  assert.ok(result.targetBonusCents <= result.maximumBonusCents);
  assert.ok(result.additionalBonusCents <= result.maximumBonusCents);
});

test("existing reservations reduce the remaining amount without crossing the cap", () => {
  const result = calculateBonusBudget({
    bidRevenueCents: 200_000n,
    prizeDebtCents: 100_000n,
    alreadyReservedCents: 9_500n,
    metrics: {
      idleSeconds: 60,
      recentBidCount: 0,
      averageBidCents: 10n,
      minimumStepCents: 10n,
      prizeCents: 100_000n,
    },
  });

  assert.equal(result.maximumBonusCents, 10_000n);
  assert.equal(result.additionalBonusCents, 500n);
});
