import assert from "node:assert/strict";
import test from "node:test";
import {
  NEXT_DISPUTE_DELAY_MS,
  getDisputeDisplayState,
  nextDisputeStartsAt,
  nextVictoryDurationSeconds,
  selectNextPrizeTier,
} from "./dispute-progression";

const tiers = [
  { id: 1, prizeCents: 50_000n, active: true },
  { id: 2, prizeCents: 100_000n, active: true },
  { id: 3, prizeCents: 250_000n, active: true },
  { id: 4, prizeCents: 1_000_000n, active: false },
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
    { id: 1, prizeCents: 50_000n, active: true },
    { id: 2, prizeCents: 50_000n, active: true },
    { id: 3, prizeCents: 100_000n, active: true },
  ];

  assert.equal(
    selectNextPrizeTier(repeatedPrizeTiers, 1, 50_000n).id,
    3,
  );
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

test("cycles the victory window through 60, 90, and 120 seconds", () => {
  assert.equal(nextVictoryDurationSeconds(60), 90);
  assert.equal(nextVictoryDurationSeconds(90), 120);
  assert.equal(nextVictoryDurationSeconds(120), 60);
  assert.equal(nextVictoryDurationSeconds(45), 60);
});

test("schedules the next dispute one minute after the previous end", () => {
  const endedAt = new Date("2026-10-25T12:00:00.000Z");
  assert.equal(
    nextDisputeStartsAt(endedAt).getTime() - endedAt.getTime(),
    NEXT_DISPUTE_DELAY_MS,
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
