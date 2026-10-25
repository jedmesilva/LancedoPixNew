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
import { usersTable } from "./users";

export const walletEntriesTable = pgTable(
  "wallet_entries",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    type: text("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    balanceAfterCents: bigint("balance_after_cents", {
      mode: "bigint",
    }).notNull(),
    refType: text("ref_type").notNull(),
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "wallet_entries_type_check",
      sql`${table.type} IN ('topup', 'bid', 'refund', 'adjustment')`,
    ),
    check("wallet_entries_amount_nonzero_check", sql`${table.amountCents} <> 0`),
    check(
      "wallet_entries_ref_type_check",
      sql`${table.refType} IN ('credit_topup', 'bid', 'manual')`,
    ),
    uniqueIndex("wallet_entries_origin_unique").on(
      table.type,
      table.refType,
      table.refId,
    ),
    index("wallet_entries_user_id_desc_idx").on(
      table.userId,
      table.id.desc(),
    ),
  ],
);

export const insertWalletEntrySchema = createInsertSchema(
  walletEntriesTable,
).omit({ id: true, createdAt: true });
export type InsertWalletEntry = z.infer<typeof insertWalletEntrySchema>;
export type WalletEntry = typeof walletEntriesTable.$inferSelect;
