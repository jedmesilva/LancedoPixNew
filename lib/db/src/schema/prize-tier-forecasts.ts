import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { prizeTiersTable } from "./prize-tiers";

export const prizeTierForecastsTable = pgTable(
  "prize_tier_forecasts",
  {
    id: bigint("id", { mode: "bigint" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    simulationId: uuid("simulation_id").notNull(),
    anchorDisputeNumber: integer("anchor_dispute_number"),
    tierId: smallint("tier_id")
      .notNull()
      .references(() => prizeTiersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    cashNetCents: bigint("cash_net_cents", { mode: "bigint" }).notNull(),
    openDebtCents: bigint("open_debt_cents", { mode: "bigint" }).notNull(),
    freeCashCents: bigint("free_cash_cents", { mode: "bigint" }).notNull(),
    minimumStepCents: bigint("minimum_step_cents", {
      mode: "bigint",
    }).notNull(),
    platformShareBps: integer("platform_share_bps").notNull(),
    coverageShareBps: integer("coverage_share_bps").notNull(),
    minimumCashCoverageBps: integer("minimum_cash_coverage_bps").notNull(),
    expectedPeople: integer("expected_people").notNull(),
    walletCreditsCents: bigint("wallet_credits_cents", {
      mode: "bigint",
    }).notNull(),
    averageSpendPerPersonCents: bigint("average_spend_per_person_cents", {
      mode: "bigint",
    }).notNull(),
    bidsPerPersonHundredths: integer("bids_per_person_hundredths").notNull(),
    expectedBids: integer("expected_bids").notNull(),
    pessimisticBids: integer("pessimistic_bids").notNull(),
    averageBidCents: bigint("average_bid_cents", { mode: "bigint" }).notNull(),
    suggestedPrizeCents: bigint("suggested_prize_cents", {
      mode: "bigint",
    }).notNull(),
    expectedCoverageCents: bigint("expected_coverage_cents", {
      mode: "bigint",
    }).notNull(),
    demandCoverageBps: integer("demand_coverage_bps").notNull(),
    cashCoverageBps: integer("cash_coverage_bps").notNull(),
    maximumLossCents: bigint("maximum_loss_cents", {
      mode: "bigint",
    }).notNull(),
    enoughHistory: boolean("enough_history").notNull(),
    cashGatePassed: boolean("cash_gate_passed").notNull(),
    demandGatePassed: boolean("demand_gate_passed").notNull(),
    passed: boolean("passed").notNull(),
    blockedReason: text("blocked_reason"),
    simulated: boolean("simulated").notNull().default(false),
  },
  (table) => [
    uniqueIndex("prize_tier_forecasts_simulation_tier_unique").on(
      table.simulationId,
      table.tierId,
    ),
    index("prize_tier_forecasts_anchor_created_idx").on(
      table.anchorDisputeNumber,
      table.createdAt.desc(),
    ),
    check("prize_tier_forecasts_expected_people_nonnegative", sql`${table.expectedPeople} >= 0`),
    check("prize_tier_forecasts_bids_nonnegative", sql`${table.expectedBids} >= 0 AND ${table.pessimisticBids} >= 0`),
    check("prize_tier_forecasts_step_positive", sql`${table.minimumStepCents} > 0`),
  ],
);

export const insertPrizeTierForecastSchema = createInsertSchema(
  prizeTierForecastsTable,
).omit({ createdAt: true });
export type InsertPrizeTierForecast = z.infer<
  typeof insertPrizeTierForecastSchema
>;
export type PrizeTierForecast = typeof prizeTierForecastsTable.$inferSelect;
