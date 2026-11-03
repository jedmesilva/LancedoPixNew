import assert from "node:assert/strict";
import test from "node:test";
import { calculateTreasuryCashPosition } from "./treasury-accounting";

test("counts settled capital contribution as available cash", () => {
  const position = calculateTreasuryCashPosition({
    settledCashCents: 100_000_000n,
    cashOutflowsCents: 0n,
    walletCreditsCents: 0n,
    walletSpendsCents: 0n,
    unpaidPrizeCents: 0n,
    reservedBonusCents: 0n,
    includesSimulated: false,
  });

  assert.equal(position.settledCashCents, 100_000_000n);
  assert.equal(position.freeCashCents, 100_000_000n);
});

test("subtracts outflows, locked wallet credits, and reserved prizes once", () => {
  const position = calculateTreasuryCashPosition({
    settledCashCents: 100_000_000n,
    cashOutflowsCents: 3_000_000n,
    walletCreditsCents: 20_000_000n,
    walletSpendsCents: 5_000_000n,
    unpaidPrizeCents: 10_000_000n,
    reservedBonusCents: 2_000_000n,
    includesSimulated: false,
  });

  assert.equal(position.lockedWalletCents, 15_000_000n);
  assert.equal(position.freeCashCents, 70_000_000n);
});
