import assert from "node:assert/strict";
import test from "node:test";
import { secondsRemainingAtOvertake } from "./bid-time";

test("returns the rounded-up time left when the next bid is recorded", () => {
  const expiresAt = new Date("2026-11-02T12:01:00.000Z");

  assert.equal(
    secondsRemainingAtOvertake(
      expiresAt,
      new Date("2026-11-02T12:00:42.250Z"),
    ),
    18,
  );
  assert.equal(
    secondsRemainingAtOvertake(
      expiresAt,
      new Date("2026-11-02T12:00:59.250Z"),
    ),
    1,
  );
});

test("never reports negative time after a bid's deadline", () => {
  const expiresAt = new Date("2026-11-02T12:01:00.000Z");

  assert.equal(secondsRemainingAtOvertake(expiresAt, expiresAt), 0);
  assert.equal(
    secondsRemainingAtOvertake(
      expiresAt,
      new Date("2026-11-02T12:01:01.000Z"),
    ),
    0,
  );
});
