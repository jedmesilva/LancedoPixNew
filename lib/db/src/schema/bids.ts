import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { disputesTable } from "./disputes";
import { usersTable } from "./users";
import { walletEntriesTable } from "./wallet-entries";

export const bidsTable = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputesTable.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    valueCents: bigint("value_cents", { mode: "bigint" }).notNull(),
    costCents: bigint("cost_cents", { mode: "bigint" }).notNull(),
    walletEntryId: bigint("wallet_entry_id", { mode: "bigint" })
      .notNull()
      .references(() => walletEntriesTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    result: text("result"),
  },
  (table) => [
    check("bids_value_positive_check", sql`${table.valueCents} > 0`),
    check(
      "bids_result_check",
      sql`${table.result} IS NULL OR ${table.result} IN ('won', 'lost')`,
    ),
    uniqueIndex("bids_dispute_value_unique").on(
      table.disputeId,
      table.valueCents,
    ),
    uniqueIndex("bids_wallet_entry_unique").on(table.walletEntryId),
    index("bids_dispute_value_desc_idx").on(
      table.disputeId,
      table.valueCents.desc(),
    ),
    index("bids_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("bids_dispute_expiry_idx").on(table.disputeId, table.expiresAt),
  ],
);

export const insertBidSchema = createInsertSchema(bidsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
