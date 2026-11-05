import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bidsTable } from "./bids";
import { disputesTable } from "./disputes";
import { usersTable } from "./users";

export const automationEventsTable = pgTable(
  "automation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    botUserId: uuid("bot_user_id").references(() => usersTable.id),
    disputeId: uuid("dispute_id").references(() => disputesTable.id),
    disputeNumber: integer("dispute_number"),
    triggerBidId: uuid("trigger_bid_id").references(() => bidsTable.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }),
    receiptReference: text("receipt_reference"),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "automation_events_type_check",
      sql`${table.eventType} IN ('bid', 'funding', 'config_updated', 'enabled', 'disabled', 'blocked')`,
    ),
    uniqueIndex("automation_events_trigger_bid_unique")
      .on(table.triggerBidId)
      .where(sql`${table.triggerBidId} IS NOT NULL`),
    uniqueIndex("automation_events_receipt_reference_unique")
      .on(table.receiptReference)
      .where(sql`${table.receiptReference} IS NOT NULL`),
    index("automation_events_created_idx").on(table.createdAt.desc()),
    index("automation_events_dispute_idx").on(
      table.disputeId,
      table.createdAt.desc(),
    ),
  ],
);

export const insertAutomationEventSchema = createInsertSchema(
  automationEventsTable,
).omit({ id: true, createdAt: true });
export type InsertAutomationEvent = z.infer<
  typeof insertAutomationEventSchema
>;
export type AutomationEventRecord = typeof automationEventsTable.$inferSelect;
