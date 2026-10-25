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
import { bonusesTable } from "./bonuses";
import { disputesTable } from "./disputes";

export const disputeCashReservationsTable = pgTable(
  "dispute_cash_reservations",
  {
    id: bigint("id", { mode: "bigint" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputesTable.id),
    reservationType: text("reservation_type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    status: text("status").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    bonusId: bigint("bonus_id", { mode: "bigint" }).references(
      () => bonusesTable.id,
    ),
    simulated: boolean("simulated").notNull().default(false),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "dispute_cash_reservation_type_check",
      sql`${table.reservationType} IN ('prize', 'bonus')`,
    ),
    check(
      "dispute_cash_reservation_status_check",
      sql`${table.status} IN ('obligated', 'funded', 'reserved', 'payout_requested', 'paid', 'released')`,
    ),
    check(
      "dispute_cash_reservation_amount_positive_check",
      sql`${table.amountCents} > 0`,
    ),
    uniqueIndex("dispute_cash_reservation_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("dispute_cash_reservation_bonus_unique").on(table.bonusId),
    index("dispute_cash_reservation_dispute_status_idx").on(
      table.disputeId,
      table.status,
    ),
  ],
);

export const insertDisputeCashReservationSchema = createInsertSchema(
  disputeCashReservationsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertDisputeCashReservation = z.infer<
  typeof insertDisputeCashReservationSchema
>;
export type DisputeCashReservation =
  typeof disputeCashReservationsTable.$inferSelect;
