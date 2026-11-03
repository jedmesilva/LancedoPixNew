import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  disputeCashReservationsTable,
  disputesTable,
  treasuryLedgerEntriesTable,
} from "@workspace/db";
import {
  calculateTreasuryCashPosition,
  type TreasuryCashPosition,
} from "./treasury-accounting";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TreasuryQueryExecutor = typeof db | Transaction;
type LedgerEntryInput = typeof treasuryLedgerEntriesTable.$inferInsert;

export const DEFAULT_INCLUDE_SIMULATED_TREASURY_ENTRIES = false;

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
  simulated = dispute.simulated,
) {
  const coveredCents =
    (dispute.bidsTotalCents * BigInt(dispute.coverageShareBps)) / 10_000n;
  const status =
    coveredCents >= dispute.prizeCents ? "funded" : "obligated";

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
    platformShareBps: number;
    coverageShareBps: number;
    simulated?: boolean;
  },
) {
  const simulated = input.simulated ?? true;
  if (input.platformShareBps + input.coverageShareBps !== 10_000) {
    throw new Error("Bid allocation shares must add up to 10000 basis points.");
  }
  const platformShareCents =
    (input.amountCents * BigInt(input.platformShareBps)) / 10_000n;
  const coverageShareCents = input.amountCents - platformShareCents;
  const metadata = {
    walletMovement: "spent",
    revenueAttribution: "dispute",
    platformShareBps: input.platformShareBps,
    coverageShareBps: input.coverageShareBps,
  };

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
  await recordLedgerEntry(transaction, {
    entryType: "platform_bid_revenue",
    amountCents: platformShareCents,
    sourceType: "bid",
    sourceId: input.bidId,
    idempotencyKey: `bid:${input.bidId}:platform-share`,
    userId: input.userId,
    disputeId: input.disputeId,
    simulated,
    metadata,
  });
  await recordLedgerEntry(transaction, {
    entryType: "prize_coverage",
    amountCents: coverageShareCents,
    sourceType: "bid",
    sourceId: input.bidId,
    idempotencyKey: `bid:${input.bidId}:prize-coverage`,
    userId: input.userId,
    disputeId: input.disputeId,
    simulated,
    metadata,
  });
}

export async function recordHouseContribution(
  transaction: Transaction,
  input: {
    id: string;
    amountCents: bigint;
    receivedAt: Date;
    simulated?: boolean;
  },
) {
  if (input.amountCents <= 0n) {
    throw new Error("A house contribution must be greater than zero.");
  }

  await recordLedgerEntry(transaction, {
    entryType: "house_contribution",
    amountCents: input.amountCents,
    sourceType: "house_contribution",
    sourceId: input.id,
    idempotencyKey: `house-contribution:${input.id}`,
    simulated: input.simulated ?? false,
    metadata: { receivedAt: input.receivedAt.toISOString() },
    createdAt: input.receivedAt,
  });
}

export async function recordDisputeCloseAdjustment(
  transaction: Transaction,
  dispute: typeof disputesTable.$inferSelect,
) {
  const coverageCents =
    (dispute.bidsTotalCents * BigInt(dispute.coverageShareBps)) / 10_000n;
  const difference = coverageCents - dispute.prizeCents;
  if (difference === 0n) return;

  const isSurplus = difference > 0n;
  await recordLedgerEntry(transaction, {
    entryType: isSurplus ? "dispute_close_surplus" : "dispute_close_loss",
    amountCents: isSurplus ? difference : -difference,
    sourceType: "dispute",
    sourceId: dispute.id,
    idempotencyKey: `dispute:${dispute.id}:closing-adjustment`,
    disputeId: dispute.id,
    simulated: dispute.simulated,
    metadata: {
      coverageCents: coverageCents.toString(),
      prizeCents: dispute.prizeCents.toString(),
    },
  });
}

export async function updatePrizeCoverage(
  transaction: Transaction,
  disputeId: string,
  coveredCents: bigint,
  prizeCents: bigint,
  now = new Date(),
) {
  await transaction
    .update(disputeCashReservationsTable)
    .set({
      status: coveredCents >= prizeCents ? "funded" : "obligated",
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

export type PrizeReleaseCashPosition = {
  cashNetCents: bigint;
  openDebtCents: bigint;
  reservedBonusCents: bigint;
  freeCashCents: bigint;
  includesSimulated: boolean;
};

export async function getPrizeReleaseCashPosition(
  transaction: Transaction,
  options: { includeSimulated?: boolean } = {},
): Promise<PrizeReleaseCashPosition> {
  const position = await getTreasuryCashPosition(options, transaction);
  const cashNetCents =
    position.settledCashCents -
    position.cashOutflowsCents -
    position.lockedWalletCents;

  return {
    cashNetCents,
    openDebtCents: position.unpaidPrizeCents,
    reservedBonusCents: position.reservedBonusCents,
    freeCashCents: position.freeCashCents,
    includesSimulated: position.includesSimulated,
  };
}

async function sumLedgerEntries(
  executor: TreasuryQueryExecutor,
  entryTypes: string[],
  includeSimulated: boolean,
): Promise<bigint> {
  const filters = [inArray(treasuryLedgerEntriesTable.entryType, entryTypes)];
  if (!includeSimulated) {
    filters.push(eq(treasuryLedgerEntriesTable.simulated, false));
  }
  const rows = await executor
    .select({ amountCents: treasuryLedgerEntriesTable.amountCents })
    .from(treasuryLedgerEntriesTable)
    .where(and(...filters));
  return rows.reduce((total, row) => total + row.amountCents, 0n);
}

export async function getTreasuryCashPosition(
  options: { includeSimulated?: boolean } = {},
  executor: TreasuryQueryExecutor = db,
): Promise<TreasuryCashPosition> {
  const includeSimulated =
    options.includeSimulated ?? DEFAULT_INCLUDE_SIMULATED_TREASURY_ENTRIES;
  const [settledCashCents, paidOutCents, refundCents, feeCents] =
    await Promise.all([
      sumLedgerEntries(
        executor,
        ["cash_receipt", "house_contribution", "ad_revenue_receipt"],
        includeSimulated,
      ),
      sumLedgerEntries(executor, ["payout_paid"], includeSimulated),
      sumLedgerEntries(executor, ["refund_paid"], includeSimulated),
      sumLedgerEntries(executor, ["processing_fee"], includeSimulated),
    ]);
  const [walletCreditsCents, walletSpendsCents] = await Promise.all([
    sumLedgerEntries(executor, ["wallet_credit"], includeSimulated),
    sumLedgerEntries(executor, ["wallet_spend"], includeSimulated),
  ]);
  const cashOutflowsCents = paidOutCents + refundCents + feeCents;

  const reservationFilters = includeSimulated
    ? []
    : [eq(disputeCashReservationsTable.simulated, false)];
  const reservations = await executor
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

  return calculateTreasuryCashPosition({
    settledCashCents,
    cashOutflowsCents,
    walletCreditsCents,
    walletSpendsCents,
    unpaidPrizeCents,
    reservedBonusCents,
    includesSimulated: includeSimulated,
  });
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
              id, simulated, jsonb_build_object('backfilled', true), created_at
      FROM disputes
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO dispute_cash_reservations
        (dispute_id, reservation_type, amount_cents, status, source_type,
         source_id, idempotency_key, simulated, metadata, created_at, updated_at)
      SELECT id, 'prize', prize_cents,
              CASE
                WHEN (bids_total_cents * coverage_share_bps / 10000) >= prize_cents
                  THEN 'funded'
                ELSE 'obligated'
              END,
             'dispute', id::text, 'dispute:' || id::text || ':prize-reservation',
              simulated, jsonb_build_object('backfilled', true), created_at, updated_at
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
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, dispute_id, simulated, metadata, created_at)
      SELECT
        'platform_bid_revenue',
        (ABS(b.cost_cents) * d.platform_share_bps / 10000),
        'bid',
        b.id::text,
        'bid:' || b.id::text || ':platform-share',
        b.user_id,
        b.dispute_id,
        (COALESCE(t.txid LIKE 'SIM-%', true) OR d.simulated),
        jsonb_build_object('backfilled', true, 'grossCents', ABS(b.cost_cents)::text),
        b.created_at
      FROM bids b
      INNER JOIN disputes d ON d.id = b.dispute_id
      LEFT JOIN wallet_entries w ON w.id = b.wallet_entry_id
      LEFT JOIN credit_topups t ON t.wallet_entry_id = w.id
      WHERE ABS(b.cost_cents) * d.platform_share_bps / 10000 > 0
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         user_id, dispute_id, simulated, metadata, created_at)
      SELECT
        'prize_coverage',
        ABS(b.cost_cents) -
          (ABS(b.cost_cents) * d.platform_share_bps / 10000),
        'bid',
        b.id::text,
        'bid:' || b.id::text || ':prize-coverage',
        b.user_id,
        b.dispute_id,
        (COALESCE(t.txid LIKE 'SIM-%', true) OR d.simulated),
        jsonb_build_object('backfilled', true, 'grossCents', ABS(b.cost_cents)::text),
        b.created_at
      FROM bids b
      INNER JOIN disputes d ON d.id = b.dispute_id
      LEFT JOIN wallet_entries w ON w.id = b.wallet_entry_id
      LEFT JOIN credit_topups t ON t.wallet_entry_id = w.id
      WHERE ABS(b.cost_cents) -
          (ABS(b.cost_cents) * d.platform_share_bps / 10000) > 0
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    await transaction.execute(sql`
      INSERT INTO treasury_ledger_entries
        (entry_type, amount_cents, source_type, source_id, idempotency_key,
         dispute_id, simulated, metadata, created_at)
      SELECT
        CASE
          WHEN coverage.covered_cents >= d.prize_cents THEN 'dispute_close_surplus'
          ELSE 'dispute_close_loss'
        END,
        ABS(coverage.covered_cents - d.prize_cents),
        'dispute',
        d.id::text,
        'dispute:' || d.id::text || ':closing-adjustment',
        d.id,
        d.simulated,
        jsonb_build_object(
          'backfilled', true,
          'coverageCents', coverage.covered_cents::text,
          'prizeCents', d.prize_cents::text
        ),
        d.ended_at
      FROM disputes d
      CROSS JOIN LATERAL (
        SELECT d.bids_total_cents * d.coverage_share_bps / 10000 AS covered_cents
      ) coverage
      WHERE d.status = 'ended'
        AND d.ended_at IS NOT NULL
        AND coverage.covered_cents <> d.prize_cents
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
