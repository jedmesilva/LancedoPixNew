import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { disputesTable } from "./disputes";
import { usersTable } from "./users";

export const treasuryLedgerEntriesTable = pgTable(
  "treasury_ledger_entries",
  {
    id: bigint("id", { mode: "bigint" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    entryType: text("entry_type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: uuid("user_id").references(() => usersTable.id),
    disputeId: uuid("dispute_id").references(() => disputesTable.id),
    simulated: boolean("simulated").notNull().default(false),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "treasury_ledger_entry_type_check",
      sql`${table.entryType} IN ('cash_receipt', 'wallet_credit', 'wallet_spend', 'bid_revenue', 'prize_obligation', 'bonus_reserved', 'payout_requested', 'payout_paid', 'refund_paid', 'processing_fee', 'ad_revenue_receipt')`,
    ),
    check(
      "treasury_ledger_amount_positive_check",
      sql`${table.amountCents} > 0`,
    ),
    uniqueIndex("treasury_ledger_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    index("treasury_ledger_dispute_created_idx").on(
      table.disputeId,
      table.createdAt.desc(),
    ),
    index("treasury_ledger_type_created_idx").on(
      table.entryType,
      table.createdAt.desc(),
    ),
  ],
);

export const insertTreasuryLedgerEntrySchema = createInsertSchema(
  treasuryLedgerEntriesTable,
).omit({ id: true, createdAt: true });
export type InsertTreasuryLedgerEntry = z.infer<
  typeof insertTreasuryLedgerEntrySchema
>;
export type TreasuryLedgerEntry =
  typeof treasuryLedgerEntriesTable.$inferSelect;
