import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const prizeTiersTable = pgTable(
  "prize_tiers",
  {
    id: smallint("id").primaryKey(),
    prizeCents: bigint("prize_cents", { mode: "bigint" }).notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    minimumStepCents: bigint("minimum_step_cents", { mode: "bigint" })
      .notNull()
      .default(sql`10`),
    minimumCashCoverageBps: integer("minimum_cash_coverage_bps"),
  },
  (table) => [
    uniqueIndex("prize_tiers_prize_cents_unique").on(table.prizeCents),
    check("prize_tiers_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "prize_tiers_minimum_step_positive",
      sql`${table.minimumStepCents} > 0`,
    ),
    check(
      "prize_tiers_cash_coverage_positive",
      sql`${table.minimumCashCoverageBps} IS NULL OR ${table.minimumCashCoverageBps} > 0`,
    ),
  ],
);

export const insertPrizeTierSchema = createInsertSchema(prizeTiersTable);
export type InsertPrizeTier = z.infer<typeof insertPrizeTierSchema>;
export type PrizeTier = typeof prizeTiersTable.$inferSelect;
