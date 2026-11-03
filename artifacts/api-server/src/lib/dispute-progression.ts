export const DISPUTE_COUNTDOWN_SECONDS = 60;
export const DISPUTE_INTERMISSION_SECONDS = 60;
const DISPUTE_COUNTDOWN_MS = DISPUTE_COUNTDOWN_SECONDS * 1_000;

export function getDisputeCountdownDeadline(startedAt: Date): Date {
  const startedAtMs = startedAt.getTime();
  if (!Number.isFinite(startedAtMs)) {
    throw new Error("A dispute countdown must start at a valid time.");
  }
  return new Date(startedAtMs + DISPUTE_COUNTDOWN_MS);
}

export function getDisputeDeadline(
  startedAt: Date | null,
  startsAt: Date,
  leaderExpiresAt: Date | null,
): Date {
  if (leaderExpiresAt) {
    if (!Number.isFinite(leaderExpiresAt.getTime())) {
      throw new Error("A leader bid must have a valid expiry time.");
    }
    return leaderExpiresAt;
  }
  return getDisputeCountdownDeadline(startedAt ?? startsAt);
}

type PrizeTierOption = {
  active: boolean;
  id: number;
  prizeCents: bigint;
  sortOrder?: number;
};

export function selectNextPrizeTier(
  tiers: readonly PrizeTierOption[],
  currentTierId: number,
  currentPrizeCents: bigint,
): PrizeTierOption {
  const activeTiers = tiers
    .filter((tier) => tier.active)
    .sort(
      (left, right) =>
        (left.sortOrder ?? left.id) - (right.sortOrder ?? right.id) ||
        left.id - right.id,
    );

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

export function nextDisputeStartsAt(endedAt: Date): Date {
  const endedAtMs = endedAt.getTime();
  if (!Number.isFinite(endedAtMs)) {
    throw new Error("An ended dispute must have a valid end time.");
  }
  return new Date(
    endedAtMs + DISPUTE_INTERMISSION_SECONDS * 1_000,
  );
}

type DisputeProgressionRecord = {
  status: string;
  startsAt: Date;
  endedAt: Date | null;
};

type DisputeDisplayPhase = "soon" | "live" | "paused" | "ended";

export function getDisputeDisplayState<
  TLatest extends DisputeProgressionRecord,
  TPrevious extends DisputeProgressionRecord = TLatest,
>(
  latest: TLatest,
  previous: TPrevious | null,
): {
  dispute: TLatest | TPrevious;
  phase: DisputeDisplayPhase;
  nextStartsAt: Date | null;
} {
  if (latest.status === "scheduled" && previous?.status === "ended") {
    return {
      dispute: previous,
      phase: "ended",
      nextStartsAt: latest.startsAt,
    };
  }

  if (latest.status === "ended") {
    if (!latest.endedAt) {
      throw new Error("An ended dispute must have a valid end time.");
    }
    return {
      dispute: latest,
      phase: "ended",
      nextStartsAt: nextDisputeStartsAt(latest.endedAt),
    };
  }

  switch (latest.status) {
    case "scheduled":
      return {
        dispute: latest,
        phase: "soon",
        nextStartsAt: latest.startsAt,
      };
    case "live":
    case "paused":
      return { dispute: latest, phase: latest.status, nextStartsAt: null };
    default:
      throw new Error(`Unsupported dispute status: ${latest.status}`);
  }
}
