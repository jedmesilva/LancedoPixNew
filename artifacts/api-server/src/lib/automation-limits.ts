type AutomationCaps = {
  maxBidCents: number | bigint;
  perDisputeLimitCents: number | bigint;
  dailyLimitCents: number | bigint;
};

export function hasInconsistentAutomationCaps(caps: AutomationCaps): boolean {
  const configuredCaps = [
    caps.maxBidCents,
    caps.perDisputeLimitCents,
    caps.dailyLimitCents,
  ]
    .map((value) => (typeof value === "bigint" ? value : BigInt(value)))
    .filter((value) => value > 0n);

  return configuredCaps.some(
    (value, index) => index > 0 && configuredCaps[index - 1]! > value,
  );
}

export function exceedsAutomationCap(limit: bigint, amount: bigint): boolean {
  return limit > 0n && amount > limit;
}

export function reachedAutomationCountCap(limit: number, count: number): boolean {
  return limit > 0 && count >= limit;
}
