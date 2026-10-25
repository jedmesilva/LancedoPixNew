export const BONUS_POLICY = {
  version: "adaptive-v1",
  maxBonusShareBps: 1_000,
  recentWindowSeconds: 60,
  idleActivationSeconds: 10,
  fullIdleScoreSeconds: 40,
  targetBidsPerWindow: 4,
  bidSizeReferenceBpsOfPrize: 100,
  awardCooldownSeconds: 15,
  idleWeightBps: 5_500,
  frequencyWeightBps: 2_500,
  bidSizeWeightBps: 2_000,
} as const;

export type BonusPolicy = typeof BONUS_POLICY;

export type BonusPolicyMetrics = {
  idleSeconds: number;
  recentBidCount: number;
  averageBidCents: bigint;
  minimumStepCents: bigint;
  prizeCents: bigint;
};

export type BonusBudget = {
  eligible: boolean;
  freeBalanceCents: bigint;
  maximumBonusCents: bigint;
  targetBonusCents: bigint;
  additionalBonusCents: bigint;
  needScoreBps: number;
};

const BASIS_POINTS = 10_000n;

function clampBps(value: bigint): number {
  if (value <= 0n) return 0;
  if (value >= BASIS_POINTS) return 10_000;
  return Number(value);
}

function ratioBps(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;
  return clampBps((numerator * BASIS_POINTS) / denominator);
}

function idleScoreBps(
  idleSeconds: number,
  policy: BonusPolicy,
): number {
  const range =
    policy.fullIdleScoreSeconds - policy.idleActivationSeconds;
  if (range <= 0 || idleSeconds <= policy.idleActivationSeconds) return 0;
  const elapsed = Math.min(
    range,
    idleSeconds - policy.idleActivationSeconds,
  );
  return Math.floor((elapsed * 10_000) / range);
}

function frequencyScoreBps(
  recentBidCount: number,
  policy: BonusPolicy,
): number {
  if (policy.targetBidsPerWindow <= 0) return 0;
  const count = Math.max(0, recentBidCount);
  if (count >= policy.targetBidsPerWindow) return 0;
  return Math.floor(
    ((policy.targetBidsPerWindow - count) * 10_000) /
      policy.targetBidsPerWindow,
  );
}

function bidSizeScoreBps(
  averageBidCents: bigint,
  minimumStepCents: bigint,
  prizeCents: bigint,
  policy: BonusPolicy,
): number {
  const prizeReference =
    (prizeCents * BigInt(policy.bidSizeReferenceBpsOfPrize)) /
    BASIS_POINTS;
  const stepReference = minimumStepCents * 5n;
  const reference = prizeReference > stepReference ? prizeReference : stepReference;
  if (reference <= 0n || averageBidCents >= reference) return 0;
  return ratioBps(reference - averageBidCents, reference);
}

export function calculateBonusNeedScoreBps(
  metrics: BonusPolicyMetrics,
  policy: BonusPolicy = BONUS_POLICY,
): number {
  const idle = idleScoreBps(metrics.idleSeconds, policy);
  const frequency = frequencyScoreBps(metrics.recentBidCount, policy);
  const bidSize = bidSizeScoreBps(
    metrics.averageBidCents,
    metrics.minimumStepCents,
    metrics.prizeCents,
    policy,
  );
  const weighted =
    BigInt(idle) * BigInt(policy.idleWeightBps) +
    BigInt(frequency) * BigInt(policy.frequencyWeightBps) +
    BigInt(bidSize) * BigInt(policy.bidSizeWeightBps);
  return Math.min(10_000, Number(weighted / BASIS_POINTS));
}

export function calculateBonusBudget(input: {
  bidRevenueCents: bigint;
  prizeDebtCents: bigint;
  alreadyReservedCents: bigint;
  metrics: BonusPolicyMetrics;
  policy?: BonusPolicy;
}): BonusBudget {
  const policy = input.policy ?? BONUS_POLICY;
  const freeBalanceCents =
    input.bidRevenueCents > input.prizeDebtCents
      ? input.bidRevenueCents - input.prizeDebtCents
      : 0n;
  const eligible = freeBalanceCents > 0n;
  const maximumBonusCents =
    (freeBalanceCents * BigInt(policy.maxBonusShareBps)) / BASIS_POINTS;
  const needScoreBps = calculateBonusNeedScoreBps(input.metrics, policy);
  const targetBonusCents =
    (maximumBonusCents * BigInt(needScoreBps)) / BASIS_POINTS;
  const remainingTarget =
    targetBonusCents > input.alreadyReservedCents
      ? targetBonusCents - input.alreadyReservedCents
      : 0n;
  const remainingHardCap =
    maximumBonusCents > input.alreadyReservedCents
      ? maximumBonusCents - input.alreadyReservedCents
      : 0n;

  return {
    eligible,
    freeBalanceCents,
    maximumBonusCents,
    targetBonusCents,
    additionalBonusCents:
      remainingTarget < remainingHardCap
        ? remainingTarget
        : remainingHardCap,
    needScoreBps,
  };
}
