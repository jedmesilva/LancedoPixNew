import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  boolean,
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
  },
  (table) => [
    uniqueIndex("prize_tiers_prize_cents_unique").on(table.prizeCents),
  ],
);

export const insertPrizeTierSchema = createInsertSchema(prizeTiersTable);
export type InsertPrizeTier = z.infer<typeof insertPrizeTierSchema>;
export type PrizeTier = typeof prizeTiersTable.$inferSelect;
