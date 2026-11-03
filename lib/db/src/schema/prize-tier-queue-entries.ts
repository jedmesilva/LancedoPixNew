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
import { disputesTable } from "./disputes";
import { prizeTierForecastsTable } from "./prize-tier-forecasts";
import { prizeTiersTable } from "./prize-tiers";

export const prizeTierQueueEntriesTable = pgTable(
  "prize_tier_queue_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id").notNull(),
    tierId: smallint("tier_id")
      .notNull()
      .references(() => prizeTiersTable.id),
    forecastId: bigint("forecast_id", { mode: "bigint" })
      .notNull()
      .references(() => prizeTierForecastsTable.id),
    position: integer("position").notNull(),
    status: text("status").notNull().default("queued"),
    disputeId: uuid("dispute_id").references(() => disputesTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("prize_tier_queue_cycle_tier_unique").on(
      table.cycleId,
      table.tierId,
    ),
    uniqueIndex("prize_tier_queue_cycle_position_unique").on(
      table.cycleId,
      table.position,
    ),
    index("prize_tier_queue_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    check("prize_tier_queue_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "prize_tier_queue_status_check",
      sql`${table.status} IN ('queued', 'used', 'skipped')`,
    ),
    check(
      "prize_tier_queue_resolution_check",
      sql`(${table.status} = 'queued' AND ${table.resolvedAt} IS NULL AND ${table.disputeId} IS NULL)
        OR (${table.status} = 'used' AND ${table.resolvedAt} IS NOT NULL AND ${table.disputeId} IS NOT NULL)
        OR (${table.status} = 'skipped' AND ${table.resolvedAt} IS NOT NULL AND ${table.disputeId} IS NULL)`,
    ),
  ],
);

export const insertPrizeTierQueueEntrySchema = createInsertSchema(
  prizeTierQueueEntriesTable,
).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertPrizeTierQueueEntry = z.infer<
  typeof insertPrizeTierQueueEntrySchema
>;
export type PrizeTierQueueEntry =
  typeof prizeTierQueueEntriesTable.$inferSelect;
