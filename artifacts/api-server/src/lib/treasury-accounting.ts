export type TreasuryCashPosition = {
  settledCashCents: bigint;
  cashOutflowsCents: bigint;
  lockedWalletCents: bigint;
  unpaidPrizeCents: bigint;
  reservedBonusCents: bigint;
  freeCashCents: bigint;
  includesSimulated: boolean;
};

export function calculateTreasuryCashPosition(input: {
  settledCashCents: bigint;
  cashOutflowsCents: bigint;
  walletCreditsCents: bigint;
  walletSpendsCents: bigint;
  unpaidPrizeCents: bigint;
  reservedBonusCents: bigint;
  includesSimulated: boolean;
}): TreasuryCashPosition {
  const rawLockedWalletCents =
    input.walletCreditsCents - input.walletSpendsCents;
  const lockedWalletCents =
    rawLockedWalletCents > 0n ? rawLockedWalletCents : 0n;
  const freeCashCents =
    input.settledCashCents -
    input.cashOutflowsCents -
    lockedWalletCents -
    input.unpaidPrizeCents -
    input.reservedBonusCents;

  return {
    settledCashCents: input.settledCashCents,
    cashOutflowsCents: input.cashOutflowsCents,
    lockedWalletCents,
    unpaidPrizeCents: input.unpaidPrizeCents,
    reservedBonusCents: input.reservedBonusCents,
    freeCashCents,
    includesSimulated: input.includesSimulated,
  };
}
