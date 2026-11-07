import { count, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  bidsTable,
  db,
  disputesTable,
  payoutRequestsTable,
  usersTable,
} from "@workspace/db";
import { getTreasuryCashPosition } from "../../lib/treasury";

const leaderBid = alias(bidsTable, "admin_leader_bid");
const leader = alias(usersTable, "admin_leader");
const winner = alias(usersTable, "admin_winner");

export function adminDisputeSummaryQuery() {
  return db
    .select({
      id: disputesTable.id,
      number: disputesTable.number,
      status: disputesTable.status,
      prizeCents: disputesTable.prizeCents,
      currentValueCents: leaderBid.valueCents,
      leaderBidExpiresAt: leaderBid.expiresAt,
      bidDurationS: disputesTable.bidDurationS,
      stepCents: disputesTable.stepCents,
      bidsCount: disputesTable.bidsCount,
      startedAt: disputesTable.startedAt,
      endedAt: disputesTable.endedAt,
      createdAt: disputesTable.createdAt,
      leaderName: leader.publicName,
      winnerName: winner.publicName,
    })
    .from(disputesTable)
    .leftJoin(leaderBid, eq(leaderBid.id, disputesTable.leaderBidId))
    .leftJoin(leader, eq(leader.id, leaderBid.userId))
    .leftJoin(winner, eq(winner.id, disputesTable.winnerId));
}

export function serializeDisputeSummary(row: {
  id: string;
  number: number;
  status: string;
  prizeCents: bigint;
  currentValueCents: bigint | null;
  leaderBidExpiresAt: Date | null;
  bidDurationS: number;
  stepCents: bigint;
  bidsCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  leaderName: string | null;
  winnerName: string | null;
}) {
  const timerDeadlineAt =
    row.status === "live"
      ? row.leaderBidExpiresAt ??
        (row.startedAt
          ? new Date(row.startedAt.getTime() + row.bidDurationS * 1_000)
          : null)
      : null;

  return {
    id: row.id,
    number: row.number,
    status: row.status as "scheduled" | "live" | "paused" | "ended",
    prizeCents: safeNumber(row.prizeCents),
    currentValueCents:
      row.currentValueCents === null ? null : safeNumber(row.currentValueCents),
    stepCents: safeNumber(row.stepCents),
    bidsCount: row.bidsCount,
    startedAt: row.startedAt?.toISOString() ?? null,
    timerDeadlineAt: timerDeadlineAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    leaderName: row.leaderName,
    winnerName: row.winnerName,
  };
}

export function safeNumber(value: bigint | number): number {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result)) {
    throw new Error("A quantia excede o limite numérico seguro da API.");
  }
  return result;
}

export function buildDisputeSearch(q: string | undefined) {
  const search = q?.trim();
  if (!search) return undefined;
  const pattern = `%${search}%`;
  return or(
    sql`${disputesTable.id}::text ILIKE ${pattern}`,
    sql`${disputesTable.number}::text ILIKE ${pattern}`,
    sql`exists (
      SELECT 1
      FROM ${bidsTable} AS search_bid
      INNER JOIN ${usersTable} AS search_user
        ON search_user.id = search_bid.user_id
      WHERE search_bid.dispute_id = ${disputesTable.id}
        AND search_user.public_name ILIKE ${pattern}
    )`,
  );
}

export async function getPendingPayoutCount() {
  const [result] = await db
    .select({ value: count() })
    .from(payoutRequestsTable)
    .where(
      inArray(payoutRequestsTable.status, ["requested", "under_review"]),
    );
  return result?.value ?? 0;
}

export async function getAdminTreasurySnapshot() {
  const position = await getTreasuryCashPosition({ includeSimulated: false });
  return {
    settledCashCents: safeNumber(position.settledCashCents),
    cashOutflowsCents: safeNumber(position.cashOutflowsCents),
    lockedWalletCents: safeNumber(position.lockedWalletCents),
    unpaidPrizeCents: safeNumber(position.unpaidPrizeCents),
    reservedBonusCents: safeNumber(position.reservedBonusCents),
    freeCashCents: safeNumber(position.freeCashCents),
    includesSimulated: false as const,
  };
}

