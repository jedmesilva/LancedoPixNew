import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { disputesTable } from "./disputes";
import { usersTable } from "./users";

export const disputeAlertsTable = pgTable(
  "dispute_alerts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputesTable.id),
    channel: text("channel").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      name: "dispute_alerts_pk",
      columns: [table.userId, table.disputeId],
    }),
    check(
      "dispute_alerts_channel_check",
      sql`${table.channel} IN ('push', 'email', 'whatsapp')`,
    ),
  ],
);

export const insertDisputeAlertSchema = createInsertSchema(
  disputeAlertsTable,
).omit({ createdAt: true });
export type InsertDisputeAlert = z.infer<typeof insertDisputeAlertSchema>;
export type DisputeAlert = typeof disputeAlertsTable.$inferSelect;
