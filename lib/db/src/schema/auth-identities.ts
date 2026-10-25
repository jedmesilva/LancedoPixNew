import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { sql } from "drizzle-orm";

export const authIdentitiesTable = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    providerEmailVerified: boolean("provider_email_verified").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "auth_identities_provider_check",
      sql`${table.provider} = 'google'`,
    ),
    uniqueIndex("auth_identities_provider_user_unique").on(
      table.provider,
      table.providerUserId,
    ),
    uniqueIndex("auth_identities_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const insertAuthIdentitySchema = createInsertSchema(
  authIdentitiesTable,
).omit({ id: true, createdAt: true });
export type InsertAuthIdentity = z.infer<typeof insertAuthIdentitySchema>;
export type AuthIdentity = typeof authIdentitiesTable.$inferSelect;
