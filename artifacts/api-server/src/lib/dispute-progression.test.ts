import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPUTE_COUNTDOWN_SECONDS,
  DISPUTE_INTERMISSION_SECONDS,
  getDisputeCountdownDeadline,
  getDisputeDeadline,
  getDisputeDisplayState,
  nextDisputeStartsAt,
  selectNextPrizeTier,
} from "./dispute-progression";

const tiers = [
  { id: 1, prizeCents: 50_000n, active: true, sortOrder: 1 },
  { id: 2, prizeCents: 100_000n, active: true, sortOrder: 2 },
  { id: 3, prizeCents: 250_000n, active: true, sortOrder: 3 },
  { id: 4, prizeCents: 1_000_000n, active: false, sortOrder: 4 },
];

test("advances to the next active prize tier and wraps at the end", () => {
  assert.equal(
    selectNextPrizeTier(tiers, 2, 100_000n).id,
    3,
  );
  assert.equal(
    selectNextPrizeTier(tiers, 3, 250_000n).id,
    1,
  );
});

test("does not select a tier with the same prize value", () => {
  const repeatedPrizeTiers = [
    { id: 1, prizeCents: 50_000n, active: true, sortOrder: 1 },
    { id: 2, prizeCents: 50_000n, active: true, sortOrder: 2 },
    { id: 3, prizeCents: 100_000n, active: true, sortOrder: 3 },
  ];

  assert.equal(
    selectNextPrizeTier(repeatedPrizeTiers, 1, 50_000n).id,
    3,
  );
});

test("uses configured tier order instead of numeric IDs", () => {
  const reorderedTiers = [
    { id: 1, prizeCents: 200n, active: true, sortOrder: 2 },
    { id: 2, prizeCents: 100n, active: true, sortOrder: 1 },
    { id: 3, prizeCents: 300n, active: true, sortOrder: 3 },
  ];

  assert.equal(selectNextPrizeTier(reorderedTiers, 2, 100n).id, 1);
});

test("requires a different active prize value", () => {
  assert.throws(
    () =>
      selectNextPrizeTier(
        [{ id: 1, prizeCents: 50_000n, active: true }],
        1,
        50_000n,
      ),
    /two active prize tiers/i,
  );
});

test("starts and resets the same 60-second countdown", () => {
  const disputeStartedAt = new Date("2026-10-25T12:00:00.000Z");
  const startsAt = new Date("2026-10-25T11:59:00.000Z");
  const bidCreatedAt = new Date("2026-10-25T12:00:45.000Z");
  const expectedMs = 60_000;

  assert.equal(DISPUTE_COUNTDOWN_SECONDS, 60);
  assert.equal(
    getDisputeDeadline(disputeStartedAt, startsAt, null).getTime(),
    disputeStartedAt.getTime() + expectedMs,
  );

  const bidDeadline = getDisputeCountdownDeadline(bidCreatedAt);
  assert.equal(
    getDisputeDeadline(disputeStartedAt, startsAt, bidDeadline).getTime(),
    bidCreatedAt.getTime() + expectedMs,
  );
});

test("keeps the result visible during the next-dispute intermission", () => {
  const endedAt = new Date("2026-10-25T12:00:00.000Z");
  const startsAt = nextDisputeStartsAt(endedAt);
  assert.equal(DISPUTE_INTERMISSION_SECONDS, 60);
  assert.equal(
    startsAt.getTime(),
    endedAt.getTime() + DISPUTE_INTERMISSION_SECONDS * 1_000,
  );
});

test("keeps the previous dispute ended while the next one is scheduled", () => {
  const endedAt = new Date("2026-10-25T12:00:00.000Z");
  const previous = {
    status: "ended",
    startsAt: new Date("2026-10-25T11:00:00.000Z"),
    endedAt,
  };
  const next = {
    status: "scheduled",
    startsAt: nextDisputeStartsAt(endedAt),
    endedAt: null,
  };

  const view = getDisputeDisplayState(next, previous);

  assert.equal(view.dispute, previous);
  assert.equal(view.phase, "ended");
  assert.equal(view.nextStartsAt?.getTime(), next.startsAt.getTime());
});

test("shows a scheduled first dispute as starting soon", () => {
  const scheduled = {
    status: "scheduled",
    startsAt: new Date("2026-10-25T12:01:00.000Z"),
    endedAt: null,
  };

  const view = getDisputeDisplayState(scheduled, null);

  assert.equal(view.dispute, scheduled);
  assert.equal(view.phase, "soon");
  assert.equal(view.nextStartsAt?.getTime(), scheduled.startsAt.getTime());
});
