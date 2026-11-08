import { and, count, countDistinct, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  disputesTable,
  payoutRequestsTable,
  siteVisitorDailyTable,
  treasuryLedgerEntriesTable,
  usersTable,
} from "@workspace/db";
import { getLanceActiveConnections } from "../../lib/realtime";
import { GetAdminDashboardResponse } from "./generated";
import {
  adminDisputeSummaryQuery,
  getAdminTreasurySnapshot,
  safeNumber,
  serializeDisputeSummary,
} from "./queries";

const router: IRouter = Router();

function saoPauloDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [current] = await adminDisputeSummaryQuery()
    .where(
      and(
        eq(disputesTable.simulated, false),
        inArray(disputesTable.status, ["scheduled", "live", "paused"]),
      ),
    )
    .orderBy(desc(disputesTable.number))
    .limit(1);
  const recentRows = await adminDisputeSummaryQuery()
    .where(eq(disputesTable.simulated, false))
    .orderBy(desc(disputesTable.number))
    .limit(8);
  const liveRows = await adminDisputeSummaryQuery()
    .where(
      and(
        eq(disputesTable.simulated, false),
        eq(disputesTable.status, "live"),
      ),
    )
    .orderBy(desc(disputesTable.number));
  const today = saoPauloDate();
  const [
    treasury,
    visitorTotals,
    visitorToday,
    disputeTotals,
    revenueRows,
    refundShareRows,
    payoutRows,
  ] = await Promise.all([
    getAdminTreasurySnapshot(),
    db
      .select({ value: countDistinct(siteVisitorDailyTable.visitorHash) })
      .from(siteVisitorDailyTable),
    db
      .select({ value: count() })
      .from(siteVisitorDailyTable)
      .where(eq(siteVisitorDailyTable.visitDate, today)),
    db
      .select({
        disputeCount: count(),
        bidCount: sql<string>`COALESCE(SUM(${disputesTable.bidsCount}), 0)::text`,
      })
      .from(disputesTable)
      .where(eq(disputesTable.simulated, false)),
    db
      .select({
        entryType: treasuryLedgerEntriesTable.entryType,
        amountCents: sql<string>`COALESCE(SUM(${treasuryLedgerEntriesTable.amountCents}), 0)::text`,
      })
      .from(treasuryLedgerEntriesTable)
      .where(
        and(
          eq(treasuryLedgerEntriesTable.simulated, false),
          inArray(treasuryLedgerEntriesTable.entryType, [
            "platform_bid_revenue",
            "prize_coverage",
          ]),
        ),
      )
      .groupBy(treasuryLedgerEntriesTable.entryType),
    db
      .select({
        platformShareCents: sql<string>`COALESCE(SUM((${treasuryLedgerEntriesTable.metadata}->>'platformShareCents')::numeric), 0)::text`,
        coverageShareCents: sql<string>`COALESCE(SUM((${treasuryLedgerEntriesTable.metadata}->>'coverageShareCents')::numeric), 0)::text`,
      })
      .from(treasuryLedgerEntriesTable)
      .where(
        and(
          eq(treasuryLedgerEntriesTable.entryType, "wallet_credit"),
          eq(treasuryLedgerEntriesTable.sourceType, "bid_refund"),
          eq(treasuryLedgerEntriesTable.simulated, false),
        ),
      ),
    db
      .select({
        status: payoutRequestsTable.status,
        count: count(),
        amountCents: sql<string>`COALESCE(SUM(${payoutRequestsTable.amountCents}), 0)::text`,
      })
      .from(payoutRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, payoutRequestsTable.userId))
      .where(eq(usersTable.testAccount, false))
      .groupBy(payoutRequestsTable.status),
  ]);
  const bidRevenue = revenueRows.find(
    (row) => row.entryType === "platform_bid_revenue",
  );
  const prizeCoverage = revenueRows.find(
    (row) => row.entryType === "prize_coverage",
  );
  const refundedPlatformShareCents = BigInt(
    refundShareRows[0]?.platformShareCents ?? "0",
  );
  const refundedCoverageShareCents = BigInt(
    refundShareRows[0]?.coverageShareCents ?? "0",
  );
  const pendingPayouts = payoutRows.filter((row) =>
    ["requested", "under_review"].includes(row.status),
  );
  const paidPayouts = payoutRows.filter((row) => row.status === "paid");

  res.json(
    GetAdminDashboardResponse.parse({
      currentDispute: current ? serializeDisputeSummary(current) : null,
      activeConnections: getLanceActiveConnections(),
      totalVisitors: visitorTotals[0]?.value ?? 0,
      visitorsToday: visitorToday[0]?.value ?? 0,
      pendingPayoutCount: pendingPayouts.reduce(
        (total, row) => total + row.count,
        0,
      ),
      pendingPayoutAmountCents: safeNumber(
        pendingPayouts.reduce((total, row) => total + BigInt(row.amountCents), 0n),
      ),
      paidPayoutCount: paidPayouts.reduce(
        (total, row) => total + row.count,
        0,
      ),
      paidPayoutAmountCents: safeNumber(
        paidPayouts.reduce((total, row) => total + BigInt(row.amountCents), 0n),
      ),
      liveDisputes: liveRows.map(serializeDisputeSummary),
      historyDisputeCount: disputeTotals[0]?.disputeCount ?? 0,
      historyBidCount: safeNumber(BigInt(disputeTotals[0]?.bidCount ?? "0")),
      platformRevenueCents: safeNumber(
        BigInt(bidRevenue?.amountCents ?? "0") - refundedPlatformShareCents,
      ),
      prizeCoverageCents: safeNumber(
        BigInt(prizeCoverage?.amountCents ?? "0") - refundedCoverageShareCents,
      ),
      treasury,
      recentDisputes: recentRows.map(serializeDisputeSummary),
    }),
  );
});

export default router;
