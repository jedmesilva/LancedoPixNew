import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  check,
  integer,
  pgTable,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const treasuryParametersTable = pgTable(
  "treasury_parameters",
  {
    id: smallint("id").primaryKey(),
    platformShareBps: integer("platform_share_bps").notNull().default(9000),
    coverageShareBps: integer("coverage_share_bps").notNull().default(1000),
    minimumCashCoverageBps: integer("minimum_cash_coverage_bps")
      .notNull()
      .default(40000),
    forecastWeeks: smallint("forecast_weeks").notNull().default(8),
    catalogVersion: integer("catalog_version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("treasury_parameters_singleton_check", sql`${table.id} = 1`),
    check(
      "treasury_parameters_share_total_check",
      sql`${table.platformShareBps} + ${table.coverageShareBps} = 10000`,
    ),
    check(
      "treasury_parameters_cash_coverage_positive_check",
      sql`${table.minimumCashCoverageBps} > 0`,
    ),
    check(
      "treasury_parameters_forecast_weeks_check",
      sql`${table.forecastWeeks} BETWEEN 1 AND 16`,
    ),
  ],
);

export const insertTreasuryParametersSchema = createInsertSchema(
  treasuryParametersTable,
).omit({ updatedAt: true });
export type InsertTreasuryParameters = z.infer<
  typeof insertTreasuryParametersSchema
>;
export type TreasuryParameters = typeof treasuryParametersTable.$inferSelect;
