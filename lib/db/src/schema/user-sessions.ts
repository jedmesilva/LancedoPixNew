import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    tokenHash: bytea("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_sessions_user_expires_idx").on(table.userId, table.expiresAt)],
);
