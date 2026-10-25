import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  disputeCashReservationsTable,
  disputesTable,
  treasuryLedgerEntriesTable,
} from "@workspace/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type LedgerEntryInput = typeof treasuryLedgerEntriesTable.$inferInsert;

export async function recordLedgerEntry(
  transaction: Transaction,
  entry: LedgerEntryInput,
) {
  await transaction
    .insert(treasuryLedgerEntriesTable)
    .values(entry)
    .onConflictDoNothing();
}

export async function ensurePrizeObligation(
  transaction: Transaction,
  dispute: typeof disputesTable.$inferSelect,
  simulated = true,
) {
  const status =
    dispute.bidsTotalCents >= dispute.prizeCents ? "funded" : "obligated";

  await recordLedgerEntry(transaction, {
    entryType: "prize_obligation",
    amountCents: dispute.prizeCents,
    sourceType: "dispute",
    sourceId: dispute.id,
    idempotencyKey: `dispute:${dispute.id}:prize-obligation`,
    disputeId: dispute.id,
    simulated,
    metadata: { prizeCents: dispute.prizeCents.toString() },
  });

  await transaction
    .insert(disputeCashReservationsTable)
    .values({
      disputeId: dispute.id,
      reservationType: "prize",
      amountCents: dispute.prizeCents,
      status,
      sourceType: "dispute",
      sourceId: dispute.id,
      idempotencyKey: `dispute:${dispute.id}:prize-reservation`,
      simulated,
      metadata: {},
    })
    .onConflictDoNothing();
}

export async function recordTopupSettlement(
  transaction: Transaction,
  input: {
    id: string;
    userId: string;
    amountCents: bigint;
    txid: string;
  },
) {
  const simulated = input.txid.startsWith("SIM-");
  const metadata = { paymentFlow: simulated ? "simulated" : "provider" };

  await recordLedgerEntry(transaction, {
    entryType: "cash_receipt",
    amountCents: input.amountCents,
    sourceType: "credit_topup",
    sourceId: input.id,
    idempotencyKey: `topup:${input.id}:cash-receipt`,
    userId: input.userId,
    simulated,
    metadata,
  });
  await recordLedgerEntry(transaction, {
    entryType: "wallet_credit",
    amountCents: input.amountCents,
    sourceType: "credit_topup",
    sourceId: input.id,
    idempotencyKey: `topup:${input.id}:wallet-credit`,
    userId: input.userId,
    simulated,
    metadata,
  });
}

export async function recordBidAllocation(
  transaction: Transaction,
  input: {
    bidId: string;
    userId: string;
    disputeId: string;
    amountCents: bigint;
    simulated?: boolean;
  },
) {
  const simulated = input.simulated ?? true;
  const metadata = { walletMovement: "spent", revenueAttribution: "dispute" };

  await recordLedgerEntry(transaction, {
    entryType: "wallet_spend",
    amountCents: input.amountCents,
    sourceType: "bid",
    sourceId: input.bidId,
    idempotencyKey: `bid:${input.bidId}:wallet-spend`,
    userId: input.userId,
    disputeId: input.disputeId,
    simulated,
    metadata,
  });
  await recordLedgerEntry(transaction, {
    entryType: "bid_revenue",
    amountCents: input.amountCents,
    sourceType: "bid",
    sourceId: input.bidId,
    idempotencyKey: `bid:${input.bidId}:dispute-revenue`,
    userId: input.userId,
    disputeId: input.disputeId,
    simulated,
    metadata,
  });
}

export async function updatePrizeCoverage(
  transaction: Transaction,
  disputeId: string,
  bidRevenueCents: bigint,
  prizeCents: bigint,
  now = new Date(),
) {
  await transaction
    .update(disputeCashReservationsTable)
    .set({
      status: bidRevenueCents >= prizeCents ? "funded" : "obligated",
      updatedAt: now,
    })
    .where(
      and(
        eq(disputeCashReservationsTable.disputeId, disputeId),
        eq(disputeCashReservationsTable.reservationType, "prize"),
        inArray(disputeCashReservationsTable.status, ["obligated", "funded"]),
      ),
    );
}

export type TreasuryCashPosition = {
  settledCashCents: bigint;
  cashOutflowsCents: bigint;
  lockedWalletCents: bigint;
  unpaidPrizeCents: bigint;
  reservedBonusCents: bigint;
  freeCashCents: bigint;
  includesSimulated: boolean;
};

async function sumLedgerEntries(
  entryTypes: string[],
  includeSimulated: boolean,
): Promise<bigint> {
  const filters = [inArray(treasuryLedgerEntriesTable.entryType, entryTypes)];
  if (!includeSimulated) {
    filters.push(eq(treasuryLedgerEntriesTable.simulated, false));
  }
  const rows = await db
    .select({ amountCents: treasuryLedgerEntriesTable.amountCents })
    .from(treasuryLedgerEntriesTable)
    .where(and(...filters));
  return rows.reduce((total, row) => total + row.amountCents, 0n);
}

export async function getTreasuryCashPosition(
  options: { includeSimulated?: boolean } = {},
): Promise<TreasuryCashPosition> {
  const includeSimulated = options.includeSimulated ?? false;
  const [settledCashCents, paidOutCents, refundCents, feeCents] =
    await Promise.all([
      sumLedgerEntries(["cash_receipt", "ad_revenue_receipt"], includeSimulated),
      sumLedgerEntries(["payout_paid"], includeSimulated),
      sumLedgerEntries(["refund_paid"], includeSimulated),
      sumLedgerEntries(["processing_fee"], includeSimulated),
    ]);
  const [walletCreditsCents, walletSpendsCents] = await Promise.all([
    sumLedgerEntries(["wallet_credit"], includeSimulated),
    sumLedgerEntries(["wallet_spend"], includeSimulated),
  ]);
  const cashOutflowsCents = paidOutCents + refundCents + feeCents;
  const rawLockedWalletCents = walletCreditsCents - walletSpendsCents;
  const lockedWalletCents =
    rawLockedWalletCents > 0n ? rawLockedWalletCents : 0n;

  const reservationFilters = includeSimulated
    ? []
    : [eq(disputeCashReservationsTable.simulated, false)];
  const reservations = await db
    .select({
      reservationType: disputeCashReservationsTable.reservationType,
      amountCents: disputeCashReservationsTable.amountCents,
    })
    .from(disputeCashReservationsTable)
    .where(
      and(
        inArray(disputeCashReservationsTable.status, [
          "obligated",
          "funded",
          "reserved",
          "payout_requested",
        ]),
        ...reservationFilters,
      ),
    );
  const unpaidPrizeCents = reservations
    .filter((row) => row.reservationType === "prize")
    .reduce((sum, row) => sum + row.amountCents, 0n);
  const reservedBonusCents = reservations
    .filter((row) => row.reservationType === "bonus")
    .reduce((sum, row) => sum + row.amountCents, 0n);
  const freeCashCents =
    settledCashCents -
    cashOutflowsCents -
    lockedWalletCents -
    unpaidPrizeCents -
    reservedBonusCents;

  return {
    settledCashCents,
    cashOutflowsCents,
    lockedWalletCents,
    unpaidPrizeCents,
    reservedBonusCents,
    freeCashCents,
    includesSimulated: includeSimulated,
  };
}

export async function backfillTreasuryLedger() {
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, simulated, metadata, created_at)
      SELECT 'cash_receipt', amount_cents, 'credit_topup', id::text,
             'topup:' || id::text || ':cash-receipt',
             user_id, (txid LIKE 'SIM-%'),
             jsonb_build_object('backfilled', true), COALESCE(paid_at, updated_at)
      FROM credit_topups
      WHERE status = 'paid'
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, simulated, metadata, created_at)
      SELECT 'wallet_credit', amount_cents, 'credit_topup', id::text,
             'topup:' || id::text || ':wallet-credit',
             user_id, (txid LIKE 'SIM-%'),
             jsonb_build_object('backfilled', true), COALESCE(paid_at, updated_at)
      FROM credit_topups
      WHERE status = 'paid'
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, dispute_id, simulated, metadata, created_at)
      SELECT 'wallet_spend', ABS(b.cost_cents), 'bid', b.id::text,
             'bid:' || b.id::text || ':wallet-spend',
             b.user_id, b.dispute_id,
             COALESCE(t.txid LIKE 'SIM-%', true),
             jsonb_build_object('backfilled', true, 'walletEntryId', b.wallet_entry_id::text),
             b.created_at
      FROM bids b
      LEFT JOIN wallet_entries w ON w.id = b.wallet_entry_id
      LEFT JOIN credit_topups t ON t.wallet_entry_id = w.id
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, dispute_id, simulated, metadata, created_at)
      SELECT 'bid_revenue', ABS(b.cost_cents), 'bid', b.id::text,
             'bid:' || b.id::text || ':dispute-revenue',
             b.user_id, b.dispute_id,
             COALESCE(t.txid LIKE 'SIM-%', true),
             jsonb_build_object('backfilled', true), b.created_at
      FROM bids b
      LEFT JOIN wallet_entries w ON w.id = b.wallet_entry_id
      LEFT JOIN credit_topups t ON t.wallet_entry_id = w.id
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         dispute_id, simulated, metadata, created_at)
      SELECT 'prize_obligation', prize_cents, 'dispute', id::text,
             'dispute:' || id::text || ':prize-obligation',
             id, true, jsonb_build_object('backfilled', true), created_at
      FROM disputes
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO dispute_cash_reservations
        (dispute_id, reservation_type, amount_cents, status, source_type,
         source_id, idempotency_key, simulated, metadata, created_at, updated_at)
      SELECT id, 'prize', prize_cents,
             CASE WHEN bids_total_cents >= prize_cents THEN 'funded' ELSE 'obligated' END,
             'dispute', id::text, 'dispute:' || id::text || ':prize-reservation',
             true, jsonb_build_object('backfilled', true), created_at, updated_at
      FROM disputes
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         dispute_id, simulated, metadata, created_at)
      SELECT 'bonus_reserved', amount_cents, 'bonus', id::text,
             'bonus:' || id::text || ':reserved',
             dispute_id, true, jsonb_build_object('backfilled', true), created_at
      FROM bonuses
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO dispute_cash_reservations
        (dispute_id, reservation_type, amount_cents, status, source_type,
         source_id, idempotency_key, bonus_id, simulated, metadata, created_at, updated_at)
      SELECT dispute_id, 'bonus', amount_cents, 'reserved', 'bonus', id::text,
             'bonus:' || id::text || ':reservation', id, true,
             jsonb_build_object('backfilled', true), created_at, created_at
      FROM bonuses
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      UPDATE disputes d
      SET bonus_total_cents = GREATEST(
        d.bonus_total_cents,
        COALESCE((SELECT SUM(b.amount_cents) FROM bonuses b WHERE b.dispute_id = d.id), 0)
      )
    `);
  });
}
