import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDemand,
  evaluateTierGates,
  type HistoricalBidActivity,
} from "./prize-forecast";

function activityForFourWeeks(): HistoricalBidActivity[] {
  return Array.from({ length: 4 }, (_, week) =>
    ["a", "b", "c"].map((userId) => ({
      weekKey: `week-${week}`,
      userId,
      bidCount: 4,
      spendCents: 1_000n,
    })),
  ).flat();
}

test("forecasts from eight same-time samples and caps spend by wallet credits", () => {
  const demand = estimateDemand(
    activityForFourWeeks(),
    new Map([
      ["a", 2_000n],
      ["b", 2_000n],
      ["c", 2_000n],
    ]),
  );

  assert.equal(demand.enoughHistory, true);
  assert.equal(demand.activeWeeks, 4);
  assert.equal(demand.distinctBidders, 3);
  assert.equal(demand.expectedPeople, 2);
  assert.equal(demand.expectedBids, 8);
  assert.equal(demand.bidsPerPersonHundredths, 400);
  assert.equal(demand.averageSpendPerPersonCents, 1_000n);
  assert.equal(demand.averageBidCents, 250n);
});

test("uses the cash reserve to bootstrap when comparable history is missing", () => {
  const demand = estimateDemand([], new Map());
  const result = evaluateTierGates({
    cashFreeCents: 10_000n,
    prizeCents: 1_000n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });

  assert.equal(demand.enoughHistory, false);
  assert.equal(result.cashGatePassed, true);
  assert.equal(result.demandGatePassed, false);
  assert.equal(result.passed, true);
  assert.equal(result.blockedReason, null);
});

test("still blocks a bootstrap tier that fails the cash reserve", () => {
  const demand = estimateDemand([], new Map());
  const result = evaluateTierGates({
    cashFreeCents: 3_999n,
    prizeCents: 1_000n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });

  assert.equal(result.cashGatePassed, false);
  assert.equal(result.passed, false);
  assert.equal(result.blockedReason, "cash");
});

test("enforces the demand gate after enough comparable history exists", () => {
  const demand = estimateDemand(
    activityForFourWeeks(),
    new Map([
      ["a", 2_000n],
      ["b", 2_000n],
      ["c", 2_000n],
    ]),
  );
  const result = evaluateTierGates({
    cashFreeCents: 10_000n,
    prizeCents: 1_000n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });

  assert.equal(demand.enoughHistory, true);
  assert.equal(result.cashGatePassed, true);
  assert.equal(result.demandGatePassed, false);
  assert.equal(result.passed, false);
  assert.equal(result.blockedReason, "demand");
});

test("applies the four-times-cash and ten-percent-demand gates", () => {
  const demand = estimateDemand(
    activityForFourWeeks(),
    new Map([
      ["a", 2_000n],
      ["b", 2_000n],
      ["c", 2_000n],
    ]),
  );
  const result = evaluateTierGates({
    cashFreeCents: 800n,
    prizeCents: 200n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });

  assert.equal(result.cashGatePassed, true);
  assert.equal(result.demandGatePassed, true);
  assert.equal(result.passed, true);
  assert.equal(result.maximumLossCents, 200n);
});

test("one million reais in free cash supports at most a 250 thousand prize at 4x", () => {
  const demand = estimateDemand(
    activityForFourWeeks(),
    new Map([
      ["a", 2_000n],
      ["b", 2_000n],
      ["c", 2_000n],
    ]),
  );
  const atCashLimit = evaluateTierGates({
    cashFreeCents: 100_000_000n,
    prizeCents: 25_000_000n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });
  const aboveCashLimit = evaluateTierGates({
    cashFreeCents: 100_000_000n,
    prizeCents: 25_000_001n,
    minimumCashCoverageBps: 40_000,
    coverageShareBps: 1_000,
    demand,
  });

  assert.equal(atCashLimit.cashGatePassed, true);
  assert.equal(aboveCashLimit.cashGatePassed, false);
});
