import assert from "node:assert/strict";
import test from "node:test";
import {
  isPastAutomationBidWindow,
  shouldWaitForAutomationTrigger,
} from "./automation-timing";

test("outbid mode waits for its configured response delay", () => {
  const now = new Date("2026-11-06T12:00:05Z");
  const actionStartedAt = new Date("2026-11-06T12:00:00Z");
  assert.equal(
    shouldWaitForAutomationTrigger({
      mode: "on_outbid",
      secondsRemaining: 30,
      configuredSeconds: 10,
      actionStartedAt,
      minimumDelaySeconds: 6,
      now,
    }),
    true,
  );
  assert.equal(
    shouldWaitForAutomationTrigger({
      mode: "on_outbid",
      secondsRemaining: 30,
      configuredSeconds: 10,
      actionStartedAt,
      minimumDelaySeconds: 5,
      now,
    }),
    false,
  );
});

test("fixed-time mode waits until the countdown reaches the chosen threshold", () => {
  const now = new Date("2026-11-06T12:00:05Z");
  const actionStartedAt = new Date("2026-11-06T12:00:00Z");
  assert.equal(
    shouldWaitForAutomationTrigger({
      mode: "at_fixed_time",
      secondsRemaining: 11,
      configuredSeconds: 10,
      actionStartedAt,
      minimumDelaySeconds: 60,
      now,
    }),
    true,
  );
  assert.equal(
    shouldWaitForAutomationTrigger({
      mode: "at_fixed_time",
      secondsRemaining: 10,
      configuredSeconds: 10,
      actionStartedAt,
      minimumDelaySeconds: 60,
      now,
    }),
    false,
  );
  assert.equal(
    shouldWaitForAutomationTrigger({
      mode: "at_fixed_time",
      secondsRemaining: 7,
      configuredSeconds: 10,
      actionStartedAt,
      minimumDelaySeconds: 60,
      now,
    }),
    false,
  );
});

test("the remaining-time cutoff only applies to outbid mode", () => {
  assert.equal(
    isPastAutomationBidWindow({
      mode: "on_outbid",
      secondsRemaining: 5,
      minimumSecondsRemaining: 10,
    }),
    true,
  );
  assert.equal(
    isPastAutomationBidWindow({
      mode: "at_fixed_time",
      secondsRemaining: 5,
      minimumSecondsRemaining: 10,
    }),
    false,
  );
});
