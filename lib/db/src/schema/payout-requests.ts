import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bidsTable } from "./bids";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const payoutRequestsTable = pgTable(
  "payout_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    prizeCents: bigint("prize_cents", { mode: "bigint" }).notNull(),
    bonusCents: bigint("bonus_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    keyType: text("key_type").notNull(),
    pixKeyEncrypted: bytea("pix_key_encrypted").notNull(),
    holderName: text("holder_name").notNull(),
    cpfEncrypted: bytea("cpf_encrypted").notNull(),
    cpfHash: bytea("cpf_hash").notNull(),
    status: text("status").notNull(),
    rejectionReason: text("rejection_reason"),
    pixE2eId: text("pix_e2e_id").unique(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "payout_requests_key_type_check",
      sql`${table.keyType} IN ('cpf', 'email', 'phone', 'random')`,
    ),
    check(
      "payout_requests_status_check",
      sql`${table.status} IN ('requested', 'under_review', 'paid', 'rejected')`,
    ),
    check(
      "payout_requests_amount_check",
      sql`${table.amountCents} = ${table.prizeCents} + ${table.bonusCents}`,
    ),
    check(
      "payout_requests_rejection_reason_check",
      sql`${table.status} <> 'rejected' OR ${table.rejectionReason} IS NOT NULL`,
    ),
    check(
      "payout_requests_paid_fields_check",
      sql`${table.status} <> 'paid' OR (${table.paidAt} IS NOT NULL AND ${table.pixE2eId} IS NOT NULL)`,
    ),
    uniqueIndex("payout_requests_active_bid_unique")
      .on(table.bidId)
      .where(sql`${table.status} <> 'rejected'`),
    index("payout_requests_user_requested_idx").on(
      table.userId,
      table.requestedAt.desc(),
    ),
  ],
);

export const insertPayoutRequestSchema = createInsertSchema(
  payoutRequestsTable,
).omit({ id: true, requestedAt: true, updatedAt: true });
export type InsertPayoutRequest = z.infer<typeof insertPayoutRequestSchema>;
export type PayoutRequest = typeof payoutRequestsTable.$inferSelect;
