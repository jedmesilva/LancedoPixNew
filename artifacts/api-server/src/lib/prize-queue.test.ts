import assert from "node:assert/strict";
import test from "node:test";
import {
  eligiblePrizeCandidates,
  shufflePrizeCandidates,
} from "./prize-queue";

test("eligible prize candidates include only active tiers with passing forecasts", () => {
  const tiers = [
    { id: 10, value: 1000 },
    { id: 20, value: 10000 },
    { id: 30, value: 100000 },
  ];
  const forecasts = [
    { tierId: 10, passed: true },
    { tierId: 20, passed: false },
  ];

  assert.deepEqual(eligiblePrizeCandidates(tiers, forecasts), [
    { tier: tiers[0], forecast: forecasts[0] },
  ]);
});

test("shuffle produces a permutation without changing the source array", () => {
  const source = ["a", "b", "c"];
  const selections = [0, 1];
  const shuffled = shufflePrizeCandidates(source, () => selections.shift()!);

  assert.deepEqual(shuffled, ["c", "b", "a"]);
  assert.deepEqual(source, ["a", "b", "c"]);
});

test("shuffle rejects an out-of-range random index", () => {
  assert.throws(
    () => shufflePrizeCandidates(["a", "b"], () => 2),
    RangeError,
  );
});
