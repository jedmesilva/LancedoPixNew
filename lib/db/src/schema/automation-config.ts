import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  timestamp,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const AUTOMATION_MODES = [
  "counterbids_only",
  "bids_and_counterbids",
  "bids_only",
] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export const AUTOMATION_BID_TRIGGER_MODES = [
  "on_outbid",
  "at_fixed_time",
] as const;
export type AutomationBidTriggerMode =
  (typeof AUTOMATION_BID_TRIGGER_MODES)[number];

export const automationConfigTable = pgTable(
  "automation_config",
  {
    id: smallint("id").primaryKey(),
    enabled: boolean("enabled").notNull().default(false),
    mode: text("mode")
      .$type<AutomationMode>()
      .notNull()
      .default("counterbids_only"),
    bidTriggerMode: text("bid_trigger_mode")
      .$type<AutomationBidTriggerMode>()
      .notNull()
      .default("on_outbid"),
    botUserId: uuid("bot_user_id").references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    maxBidCents: bigint("max_bid_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    perDisputeLimitCents: bigint("per_dispute_limit_cents", {
      mode: "bigint",
    })
      .notNull()
      .default(sql`0`),
    dailyLimitCents: bigint("daily_limit_cents", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    maxBidsPerDispute: integer("max_bids_per_dispute")
      .notNull()
      .default(0),
    minimumSecondsRemaining: smallint("minimum_seconds_remaining")
      .notNull()
      .default(10),
    minimumDelaySeconds: smallint("minimum_delay_seconds")
      .notNull()
      .default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("automation_config_singleton_check", sql`${table.id} = 1`),
    check(
      "automation_config_mode_check",
      sql`${table.mode} IN ('counterbids_only', 'bids_and_counterbids', 'bids_only')`,
    ),
    check(
      "automation_config_bid_trigger_mode_check",
      sql`${table.bidTriggerMode} IN ('on_outbid', 'at_fixed_time')`,
    ),
    check(
      "automation_config_limits_nonnegative_check",
      sql`${table.maxBidCents} >= 0 AND ${table.perDisputeLimitCents} >= 0 AND ${table.dailyLimitCents} >= 0 AND ${table.maxBidsPerDispute} >= 0`,
    ),
    check(
      "automation_config_timing_positive_check",
      sql`${table.minimumSecondsRemaining} > 0 AND ${table.minimumDelaySeconds} > 0`,
    ),
  ],
);

export const insertAutomationConfigSchema = createInsertSchema(
  automationConfigTable,
).omit({ updatedAt: true });
export type InsertAutomationConfig = z.infer<
  typeof insertAutomationConfigSchema
>;
export type AutomationConfig = typeof automationConfigTable.$inferSelect;
