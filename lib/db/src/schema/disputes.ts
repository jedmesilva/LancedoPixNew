import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
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
import { usersTable } from "./users";

export const disputesTable = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull(),
    tierId: smallint("tier_id")
      .notNull()
      .references(() => prizeTiersTable.id),
    prizeCents: bigint("prize_cents", { mode: "bigint" }).notNull(),
    startingValueCents: bigint("starting_value_cents", {
      mode: "bigint",
    })
      .notNull()
      .default(0n),
    stepCents: bigint("step_cents", { mode: "bigint" }).notNull(),
    bidDurationS: integer("bid_duration_s").notNull(),
    status: text("status").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    pausedRemainingS: integer("paused_remaining_s"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedTotalS: integer("paused_total_s").notNull().default(0),
    // The pointer is maintained transactionally; its FK would create a cyclic
    // table dependency with bids.dispute_id in Drizzle's schema push.
    leaderBidId: uuid("leader_bid_id"),
    bidsCount: integer("bids_count").notNull().default(0),
    bidsTotalCents: bigint("bids_total_cents", { mode: "bigint" })
      .notNull()
      .default(0n),
    bonusTotalCents: bigint("bonus_total_cents", { mode: "bigint" })
      .notNull()
      .default(0n),
    winnerId: uuid("winner_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("disputes_number_unique").on(table.number),
    check(
      "disputes_status_check",
      sql`${table.status} IN ('scheduled', 'live', 'paused', 'ended')`,
    ),
    check("disputes_step_positive_check", sql`${table.stepCents} > 0`),
    check(
      "disputes_bid_duration_positive_check",
      sql`${table.bidDurationS} > 0`,
    ),
    check(
      "disputes_ended_at_check",
      sql`${table.status} <> 'ended' OR ${table.endedAt} IS NOT NULL`,
    ),
    check(
      "disputes_paused_fields_check",
      sql`${table.status} <> 'paused' OR (${table.pausedAt} IS NOT NULL AND ${table.pausedRemainingS} IS NOT NULL)`,
    ),
    check(
      "disputes_paused_totals_nonnegative_check",
      sql`${table.pausedTotalS} >= 0 AND (${table.pausedRemainingS} IS NULL OR ${table.pausedRemainingS} >= 0)`,
    ),
    check("disputes_bids_count_nonnegative_check", sql`${table.bidsCount} >= 0`),
    check(
      "disputes_bonus_total_nonnegative_check",
      sql`${table.bonusTotalCents} >= 0`,
    ),
    index("disputes_status_starts_at_idx").on(table.status, table.startsAt),
    index("disputes_leader_bid_id_idx").on(table.leaderBidId),
  ],
);

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
