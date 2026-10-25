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
  boolean,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { payoutRequestsTable } from "./payout-requests";

export const payoutEventsTable = pgTable(
  "payout_events",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payoutRequestsTable.id),
    status: text("status").notNull(),
    note: text("note"),
    visibleToUser: boolean("visible_to_user").notNull().default(true),
    author: text("author").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "payout_events_status_check",
      sql`${table.status} IN ('requested', 'under_review', 'paid', 'rejected')`,
    ),
    index("payout_events_payout_id_idx").on(table.payoutId, table.id),
  ],
);

export const insertPayoutEventSchema = createInsertSchema(
  payoutEventsTable,
).omit({ id: true, createdAt: true });
export type InsertPayoutEvent = z.infer<typeof insertPayoutEventSchema>;
export type PayoutEvent = typeof payoutEventsTable.$inferSelect;
