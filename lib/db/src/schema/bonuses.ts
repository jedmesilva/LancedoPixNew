import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { disputesTable } from "./disputes";

export const bonusesTable = pgTable(
  "bonuses",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputesTable.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    note: text("note"),
    author: text("author").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("bonuses_amount_nonzero_check", sql`${table.amountCents} <> 0`),
    index("bonuses_dispute_id_idx").on(table.disputeId, table.id),
  ],
);

export const insertBonusSchema = createInsertSchema(bonusesTable).omit({
  createdAt: true,
});
export type InsertBonus = z.infer<typeof insertBonusSchema>;
export type Bonus = typeof bonusesTable.$inferSelect;
