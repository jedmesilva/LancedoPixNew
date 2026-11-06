import {
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const siteVisitorDailyTable = pgTable(
  "site_visitor_daily",
  {
    visitorHash: text("visitor_hash").notNull(),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("site_visitor_daily_hash_date_unique").on(
      table.visitorHash,
      table.visitDate,
    ),
  ],
);
