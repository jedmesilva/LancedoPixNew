import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import {
  db,
  disputesTable,
  prizeTierForecastsTable,
  prizeTiersTable,
  treasuryParametersTable,
  walletsTable,
  usersTable,
  bidsTable,
} from "@workspace/db";
import {
  DEFAULT_INCLUDE_SIMULATED_TREASURY_ENTRIES,
  getPrizeReleaseCashPosition,
} from "./treasury";
import {
  estimateDemand,
  evaluateTierGates,
  type HistoricalBidActivity,
} from "./prize-forecast";

const CATALOG_VERSION = 1;
const DEFAULT_STEP_CENTS = 10n;
const BASIS_POINTS = 10_000n;
const FORECAST_REUSE_MS = 60_000;
const TARGET_PRIZES_CENTS = [
  1_000n,
  2_000n,
  5_000n,
  10_000n,
  100_000n,
  1_000_000n,
  1_500_000n,
  2_500_000n,
  3_000_000n,
  5_000_000n,
  10_000_000n,
  25_000_000n,
  30_000_000n,
  50_000_000n,
  100_000_000n,
] as const;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ForecastBatch = {
  forecasts: (typeof prizeTierForecastsTable.$inferSelect)[];
  parameters: typeof treasuryParametersTable.$inferSelect;
  tiers: (typeof prizeTiersTable.$inferSelect)[];
};

export async function ensureTreasuryCatalog(transaction: Transaction) {
  await transaction
    .insert(treasuryParametersTable)
    .values({ id: 1 })
    .onConflictDoNothing();

  const [parameters] = await transaction
    .select()
    .from(treasuryParametersTable)
    .where(eq(treasuryParametersTable.id, 1))
    .limit(1)
    .for("update");
  if (!parameters) throw new Error("Treasury parameters could not be initialized.");

  if (parameters.catalogVersion < CATALOG_VERSION) {
    const existingTiers = await transaction
      .select()
      .from(prizeTiersTable)
      .orderBy(asc(prizeTiersTable.id));
    const byPrize = new Map(
      existingTiers.map((tier) => [tier.prizeCents.toString(), tier]),
    );
    let nextId =
      existingTiers.reduce((maxId, tier) => Math.max(maxId, tier.id), 0) + 1;

    for (const [index, prizeCents] of TARGET_PRIZES_CENTS.entries()) {
      const existing = byPrize.get(prizeCents.toString());
      if (existing) {
        await transaction
          .update(prizeTiersTable)
          .set({ active: true, sortOrder: index + 1 })
          .where(eq(prizeTiersTable.id, existing.id));
      } else {
        await transaction.insert(prizeTiersTable).values({
          id: nextId,
          prizeCents,
          active: true,
          sortOrder: index + 1,
          minimumStepCents: DEFAULT_STEP_CENTS,
        });
        nextId += 1;
      }
    }

    const targetValues = TARGET_PRIZES_CENTS.map((value) => value.toString());
    for (const tier of existingTiers) {
      if (!targetValues.includes(tier.prizeCents.toString())) {
        await transaction
          .update(prizeTiersTable)
          .set({ active: false })
          .where(eq(prizeTiersTable.id, tier.id));
      }
    }

    await transaction
      .update(treasuryParametersTable)
      .set({ catalogVersion: CATALOG_VERSION, updatedAt: new Date() })
      .where(eq(treasuryParametersTable.id, 1));
  }

  const [currentParameters] = await transaction
    .select()
    .from(treasuryParametersTable)
    .where(eq(treasuryParametersTable.id, 1))
    .limit(1);
  if (!currentParameters) throw new Error("Treasury parameters are missing.");

  const tiers = await transaction
    .select()
    .from(prizeTiersTable)
    .where(eq(prizeTiersTable.active, true))
    .orderBy(asc(prizeTiersTable.sortOrder), asc(prizeTiersTable.id));

  return { parameters: currentParameters, tiers };
}

export async function createOrReuseForecastBatch(
  transaction: Transaction,
  input: {
    anchorDisputeNumber: number | null;
    startsAt: Date;
    currentTierId?: number;
    currentPrizeCents?: bigint;
  },
): Promise<ForecastBatch> {
  const anchorFilter =
    input.anchorDisputeNumber === null
      ? isNull(prizeTierForecastsTable.anchorDisputeNumber)
      : eq(
          prizeTierForecastsTable.anchorDisputeNumber,
          input.anchorDisputeNumber,
        );
  const [latest] = await transaction
    .select({
      simulationId: prizeTierForecastsTable.simulationId,
      createdAt: prizeTierForecastsTable.createdAt,
      startsAt: prizeTierForecastsTable.startsAt,
    })
    .from(prizeTierForecastsTable)
    .where(anchorFilter)
    .orderBy(desc(prizeTierForecastsTable.createdAt))
    .limit(1);

  if (
    latest &&
    latest.startsAt.getTime() === input.startsAt.getTime() &&
    Date.now() - latest.createdAt.getTime() < FORECAST_REUSE_MS
  ) {
    const forecasts = await transaction
      .select()
      .from(prizeTierForecastsTable)
      .where(eq(prizeTierForecastsTable.simulationId, latest.simulationId))
      .orderBy(asc(prizeTierForecastsTable.tierId));
    const { parameters, tiers } = await ensureTreasuryCatalog(transaction);
    return { forecasts, parameters, tiers };
  }

  const { parameters, tiers } = await ensureTreasuryCatalog(transaction);
  const includeSimulated = DEFAULT_INCLUDE_SIMULATED_TREASURY_ENTRIES;
  const cashPosition = await getPrizeReleaseCashPosition(transaction, {
    includeSimulated,
  });
  const activity = await getComparableHistory(
    transaction,
    input.startsAt,
    parameters.forecastWeeks,
  );
  const activeUserIds = [...new Set(activity.map((row) => row.userId))];
  const wallets = activeUserIds.length
    ? await transaction
        .select({
          userId: walletsTable.userId,
          balanceCents: walletsTable.balanceCents,
        })
        .from(walletsTable)
        .where(inArray(walletsTable.userId, activeUserIds))
    : [];
  const walletBalances = new Map(
    wallets.map((wallet) => [wallet.userId, wallet.balanceCents]),
  );
  const simulationId = randomUUID();
  const forecasts = [];

  for (const tier of tiers) {
    const minimumCashCoverageBps =
      tier.minimumCashCoverageBps ?? parameters.minimumCashCoverageBps;
    const demand = estimateDemand(
      activity,
      walletBalances,
      parameters.forecastWeeks,
    );
    const gates = evaluateTierGates({
      cashFreeCents: cashPosition.freeCashCents,
      prizeCents: tier.prizeCents,
      minimumCashCoverageBps,
      coverageShareBps: parameters.coverageShareBps,
      demand,
    });

    const [forecast] = await transaction
      .insert(prizeTierForecastsTable)
      .values({
        simulationId,
        anchorDisputeNumber: input.anchorDisputeNumber,
        tierId: tier.id,
        startsAt: input.startsAt,
        cashNetCents: cashPosition.cashNetCents,
        openDebtCents: cashPosition.openDebtCents,
        freeCashCents: cashPosition.freeCashCents,
        minimumStepCents: tier.minimumStepCents,
        platformShareBps: parameters.platformShareBps,
        coverageShareBps: parameters.coverageShareBps,
        minimumCashCoverageBps,
        expectedPeople: demand.expectedPeople,
        walletCreditsCents: demand.walletCreditsCents,
        averageSpendPerPersonCents: demand.averageSpendPerPersonCents,
        bidsPerPersonHundredths: demand.bidsPerPersonHundredths,
        expectedBids: demand.expectedBids,
        pessimisticBids: demand.pessimisticBids,
        averageBidCents: demand.averageBidCents,
        suggestedPrizeCents: tier.prizeCents,
        expectedCoverageCents: gates.expectedCoverageCents,
        demandCoverageBps: gates.demandCoverageBps,
        cashCoverageBps: gates.cashCoverageBps,
        maximumLossCents: gates.maximumLossCents,
        enoughHistory: demand.enoughHistory,
        cashGatePassed: gates.cashGatePassed,
        demandGatePassed: gates.demandGatePassed,
        passed: gates.passed,
        blockedReason: gates.blockedReason,
        simulated: includeSimulated,
      })
      .returning();
    if (forecast) forecasts.push(forecast);
  }

  return { forecasts, parameters, tiers };
}

async function getComparableHistory(
  transaction: Transaction,
  targetAt: Date,
  forecastWeeks: number,
): Promise<HistoricalBidActivity[]> {
  const lookback = new Date(
    targetAt.getTime() - forecastWeeks * 7 * 24 * 60 * 60 * 1000,
  );
  const localCreatedAt = sql`(${bidsTable.createdAt} AT TIME ZONE 'America/Sao_Paulo')`;
  const localTargetAt = sql`(${targetAt}::timestamptz AT TIME ZONE 'America/Sao_Paulo')`;
  const weekKey = sql<string>`to_char(date_trunc('week', ${localCreatedAt}), 'YYYY-MM-DD')`;
  const rows = await transaction
    .select({
      weekKey,
      userId: bidsTable.userId,
      bidCount: sql<number>`count(*)::int`,
      spendCents: sql<string>`sum(${bidsTable.costCents})::text`,
    })
    .from(bidsTable)
    .innerJoin(usersTable, eq(bidsTable.userId, usersTable.id))
    .innerJoin(disputesTable, eq(bidsTable.disputeId, disputesTable.id))
    .where(
      and(
        gte(bidsTable.createdAt, lookback),
        lt(bidsTable.createdAt, targetAt),
        eq(usersTable.testAccount, false),
        sql`extract(isodow from ${localCreatedAt}) = extract(isodow from ${localTargetAt})`,
        sql`extract(hour from ${localCreatedAt}) = extract(hour from ${localTargetAt})`,
      ),
    )
    .groupBy(weekKey, bidsTable.userId);

  return rows.map((row) => ({
    weekKey: row.weekKey,
    userId: row.userId,
    bidCount: row.bidCount,
    spendCents: BigInt(row.spendCents ?? "0"),
  }));
}

export function selectPassingForecast(
  batch: ForecastBatch,
  currentTierId?: number,
  currentPrizeCents?: bigint,
) {
  const ordered = [...batch.tiers].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.id - right.id,
  );
  let startIndex = 0;
  if (currentTierId !== undefined) {
    const index = ordered.findIndex((tier) => tier.id === currentTierId);
    if (index >= 0) startIndex = (index + 1) % ordered.length;
  }

  for (let offset = 0; offset < ordered.length; offset += 1) {
    const tier = ordered[(startIndex + offset) % ordered.length];
    if (!tier || tier.prizeCents === currentPrizeCents) continue;
    const forecast = batch.forecasts.find((row) => row.tierId === tier.id);
    if (forecast?.passed) return { tier, forecast };
  }
  return null;
}

