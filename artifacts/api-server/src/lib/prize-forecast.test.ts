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

test("blocks a forecast with too little comparable history", () => {
  const demand = estimateDemand(
    activityForFourWeeks().slice(0, 3),
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

  assert.equal(demand.enoughHistory, false);
  assert.equal(result.passed, false);
  assert.equal(result.blockedReason, "history");
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
