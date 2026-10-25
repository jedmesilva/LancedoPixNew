import { createInsertSchema } from "drizzle-zod";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const pixWebhookEventsTable = pgTable(
  "pix_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("pix_webhook_events_event_id_unique").on(table.eventId),
    index("pix_webhook_events_received_at_idx").on(table.receivedAt),
  ],
);

export const insertPixWebhookEventSchema = createInsertSchema(
  pixWebhookEventsTable,
).omit({ id: true, receivedAt: true });
export type InsertPixWebhookEvent = z.infer<
  typeof insertPixWebhookEventSchema
>;
export type PixWebhookEvent = typeof pixWebhookEventsTable.$inferSelect;
