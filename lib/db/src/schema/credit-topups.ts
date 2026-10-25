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
import { walletEntriesTable } from "./wallet-entries";

export const creditTopupsTable = pgTable(
  "credit_topups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    status: text("status").notNull(),
    txid: text("txid").notNull().unique(),
    pixCopyPaste: text("pix_copy_paste").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    walletEntryId: bigint("wallet_entry_id", { mode: "bigint" }).references(
      () => walletEntriesTable.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("credit_topups_amount_positive_check", sql`${table.amountCents} > 0`),
    check(
      "credit_topups_status_check",
      sql`${table.status} IN ('pending', 'paid', 'expired', 'failed')`,
    ),
    check(
      "credit_topups_paid_fields_check",
      sql`${table.status} <> 'paid' OR (${table.paidAt} IS NOT NULL AND ${table.walletEntryId} IS NOT NULL)`,
    ),
    uniqueIndex("credit_topups_wallet_entry_unique").on(table.walletEntryId),
    index("credit_topups_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    index("credit_topups_pending_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const insertCreditTopupSchema = createInsertSchema(
  creditTopupsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditTopup = z.infer<typeof insertCreditTopupSchema>;
export type CreditTopup = typeof creditTopupsTable.$inferSelect;
