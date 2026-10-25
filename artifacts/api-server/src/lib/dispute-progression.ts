export const NEXT_DISPUTE_DELAY_MS = 60_000;
export const VICTORY_DURATION_CYCLE_SECONDS = [60, 90, 120] as const;

type PrizeTierOption = {
  active: boolean;
  id: number;
  prizeCents: bigint;
};

export function selectNextPrizeTier(
  tiers: readonly PrizeTierOption[],
  currentTierId: number,
  currentPrizeCents: bigint,
): PrizeTierOption {
  const activeTiers = tiers
    .filter((tier) => tier.active)
    .sort((left, right) => left.id - right.id);

  if (activeTiers.length < 2) {
    throw new Error(
      "At least two active prize tiers are required to create a new dispute prize.",
    );
  }

  const currentIndex = activeTiers.findIndex(
    (tier) => tier.id === currentTierId,
  );
  const firstCandidate = currentIndex < 0 ? 0 : currentIndex + 1;

  for (let offset = 0; offset < activeTiers.length; offset += 1) {
    const tier = activeTiers[(firstCandidate + offset) % activeTiers.length];
    if (tier && tier.prizeCents !== currentPrizeCents) return tier;
  }

  throw new Error(
    "At least two distinct active prize values are required to create a new dispute prize.",
  );
}

export function nextVictoryDurationSeconds(currentDuration: number): number {
  const currentIndex = VICTORY_DURATION_CYCLE_SECONDS.indexOf(
    currentDuration as (typeof VICTORY_DURATION_CYCLE_SECONDS)[number],
  );

  if (currentIndex < 0) return VICTORY_DURATION_CYCLE_SECONDS[0];
  return VICTORY_DURATION_CYCLE_SECONDS[
    (currentIndex + 1) % VICTORY_DURATION_CYCLE_SECONDS.length
  ];
}

export function nextDisputeStartsAt(endedAt: Date): Date {
  const endedAtMs = endedAt.getTime();
  if (!Number.isFinite(endedAtMs)) {
    throw new Error("An ended dispute must have a valid end time.");
  }
  return new Date(endedAtMs + NEXT_DISPUTE_DELAY_MS);
}
