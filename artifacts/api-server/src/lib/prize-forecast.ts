const BASIS_POINTS = 10_000n;
const HISTORY_WEEKS = 8;
const MIN_ACTIVE_WEEKS = 4;
const MIN_DISTINCT_BIDDERS = 3;

export type HistoricalBidActivity = {
  weekKey: string;
  userId: string;
  bidCount: number;
  spendCents: bigint;
};

export type DemandEstimate = {
  enoughHistory: boolean;
  activeWeeks: number;
  distinctBidders: number;
  expectedPeople: number;
  walletCreditsCents: bigint;
  averageSpendPerPersonCents: bigint;
  bidsPerPersonHundredths: number;
  expectedBids: number;
  pessimisticBids: number;
  averageBidCents: bigint;
};

export type TierGateResult = {
  cashGatePassed: boolean;
  demandGatePassed: boolean;
  passed: boolean;
  blockedReason: "history" | "cash" | "demand" | "cash_and_demand" | null;
  expectedCoverageCents: bigint;
  demandCoverageBps: number;
  cashCoverageBps: number;
  maximumLossCents: bigint;
};

export function estimateDemand(
  activity: readonly HistoricalBidActivity[],
  walletBalances: ReadonlyMap<string, bigint>,
  forecastWeeks = HISTORY_WEEKS,
): DemandEstimate {
  const weeklyBids = new Map<string, number>();
  const weeklyPeople = new Map<string, Set<string>>();
  const activeUsers = new Set<string>();
  let totalBids = 0;
  let totalParticipants = 0;
  let totalSpendCents = 0n;

  for (const row of activity) {
    if (!Number.isFinite(row.bidCount) || row.bidCount < 0) continue;
    weeklyBids.set(
      row.weekKey,
      (weeklyBids.get(row.weekKey) ?? 0) + row.bidCount,
    );
    let people = weeklyPeople.get(row.weekKey);
    if (!people) {
      people = new Set<string>();
      weeklyPeople.set(row.weekKey, people);
    }
    people.add(row.userId);
    activeUsers.add(row.userId);
    totalBids += row.bidCount;
    totalParticipants += 1;
    totalSpendCents += row.spendCents > 0n ? row.spendCents : 0n;
  }

  const activeWeeks = [...weeklyBids.values()].filter((count) => count > 0).length;
  const walletCreditsCents = [...activeUsers].reduce(
    (sum, userId) => sum + (walletBalances.get(userId) ?? 0n),
    0n,
  );
  const expectedPeople = Math.round(totalParticipants / forecastWeeks);
  const bidsPerPersonHundredths =
    totalParticipants > 0
      ? Math.round((totalBids * 100) / totalParticipants)
      : 0;
  const expectedBids = Math.round(
    (expectedPeople * bidsPerPersonHundredths) / 100,
  );
  const historicalSpendPerPersonCents =
    totalParticipants > 0
      ? totalSpendCents / BigInt(totalParticipants)
      : 0n;
  const walletCreditsPerActivePersonCents =
    activeUsers.size > 0
      ? walletCreditsCents / BigInt(activeUsers.size)
      : 0n;
  const averageSpendPerPersonCents =
    historicalSpendPerPersonCents < walletCreditsPerActivePersonCents
      ? historicalSpendPerPersonCents
      : walletCreditsPerActivePersonCents;
  const averageBidCents =
    bidsPerPersonHundredths > 0
      ? (averageSpendPerPersonCents * 100n +
          BigInt(Math.floor(bidsPerPersonHundredths / 2))) /
        BigInt(bidsPerPersonHundredths)
      : 0n;
  const pessimisticBids =
    activeWeeks < forecastWeeks || forecastWeeks < 1
      ? 0
      : Math.min(...weeklyBids.values());

  return {
    enoughHistory:
      activeWeeks >= Math.min(MIN_ACTIVE_WEEKS, forecastWeeks) &&
      activeUsers.size >= MIN_DISTINCT_BIDDERS,
    activeWeeks,
    distinctBidders: activeUsers.size,
    expectedPeople,
    walletCreditsCents,
    averageSpendPerPersonCents,
    bidsPerPersonHundredths,
    expectedBids,
    pessimisticBids,
    averageBidCents,
  };
}

export function evaluateTierGates(input: {
  cashFreeCents: bigint;
  prizeCents: bigint;
  minimumCashCoverageBps: number;
  coverageShareBps: number;
  demand: DemandEstimate;
}): TierGateResult {
  const {
    cashFreeCents,
    prizeCents,
    minimumCashCoverageBps,
    coverageShareBps,
    demand,
  } = input;
  const minimumCashCents =
    (prizeCents * BigInt(minimumCashCoverageBps) + BASIS_POINTS - 1n) /
    BASIS_POINTS;
  const expectedCoverageCents =
    (BigInt(demand.expectedBids) *
      demand.averageBidCents *
      BigInt(coverageShareBps)) /
    BASIS_POINTS;
  const pessimisticCoverageCents =
    (BigInt(demand.pessimisticBids) *
      demand.averageBidCents *
      BigInt(coverageShareBps)) /
    BASIS_POINTS;
  const demandCoverageBps =
    prizeCents > 0n
      ? toSafeInteger((expectedCoverageCents * BASIS_POINTS) / prizeCents)
      : 0;
  const cashCoverageBps =
    prizeCents > 0n && cashFreeCents > 0n
      ? toSafeInteger((cashFreeCents * BASIS_POINTS) / prizeCents)
      : 0;
  const cashGatePassed = cashFreeCents >= minimumCashCents;
  const demandGatePassed = expectedCoverageCents >= prizeCents;
  const passed = demand.enoughHistory && cashGatePassed && demandGatePassed;
  let blockedReason: TierGateResult["blockedReason"] = null;

  if (!demand.enoughHistory) blockedReason = "history";
  else if (!cashGatePassed && !demandGatePassed) {
    blockedReason = "cash_and_demand";
  } else if (!cashGatePassed) blockedReason = "cash";
  else if (!demandGatePassed) blockedReason = "demand";

  return {
    cashGatePassed,
    demandGatePassed,
    passed,
    blockedReason,
    expectedCoverageCents,
    demandCoverageBps,
    cashCoverageBps,
    maximumLossCents:
      prizeCents > pessimisticCoverageCents
        ? prizeCents - pessimisticCoverageCents
        : 0n,
  };
}

function toSafeInteger(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  if (value < BigInt(Number.MIN_SAFE_INTEGER)) return Number.MIN_SAFE_INTEGER;
  return Number(value);
}
