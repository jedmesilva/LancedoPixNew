import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const authTokensTable = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    purpose: text("purpose").notNull(),
    tokenHash: bytea("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "auth_tokens_purpose_check",
      sql`${table.purpose} IN ('password_reset', 'email_verification')`,
    ),
    index("auth_tokens_user_purpose_created_idx").on(
      table.userId,
      table.purpose,
      table.createdAt.desc(),
    ),
  ],
);

export const insertAuthTokenSchema = createInsertSchema(authTokensTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuthToken = z.infer<typeof insertAuthTokenSchema>;
export type AuthToken = typeof authTokensTable.$inferSelect;
