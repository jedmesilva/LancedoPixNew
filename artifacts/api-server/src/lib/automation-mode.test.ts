import assert from "node:assert/strict";
import test from "node:test";
import { getAutomationBidAction } from "./automation-mode";

const cases = [
  ["counterbids_only", false, false, null],
  ["counterbids_only", true, false, "counterbid"],
  ["counterbids_only", true, true, null],
  ["bids_and_counterbids", false, false, "opening_bid"],
  ["bids_and_counterbids", true, false, "counterbid"],
  ["bids_and_counterbids", true, true, null],
  ["bids_only", false, false, "opening_bid"],
  ["bids_only", true, false, null],
  ["bids_only", true, true, null],
] as const;

for (const [mode, hasLeader, leaderIsBot, expected] of cases) {
  test(`${mode}: leader=${hasLeader}, botLeader=${leaderIsBot}`, () => {
    assert.equal(
      getAutomationBidAction(mode, hasLeader, leaderIsBot),
      expected,
    );
  });
}
