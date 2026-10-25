import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  check,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletsTable = pgTable(
  "wallets",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => usersTable.id),
    balanceCents: bigint("balance_cents", { mode: "bigint" })
      .notNull()
      .default(0n),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("wallets_balance_nonnegative_check", sql`${table.balanceCents} >= 0`),
  ],
);

export const insertWalletSchema = createInsertSchema(walletsTable);
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
