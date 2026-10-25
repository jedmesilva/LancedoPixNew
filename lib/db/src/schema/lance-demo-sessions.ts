import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type DemoPhase = "live" | "paused" | "ended" | "soon";
export type DemoPaymentState = "pending" | "paid" | "expired" | "failed";

export interface LanceDemoStoredState {
  version: 1;
  user: {
    name: string;
    email: string;
    signedIn: boolean;
  };
  auction: {
    round: number;
    p: number;
    phase: DemoPhase;
    value: number;
    leader: number;
    left: number;
    soon: number;
    bonusSecs: number;
    notify: boolean;
    H: Array<{ n: number; v: number; t: number }>;
    deadlineAt: number | null;
    soonAt: number | null;
    liveSince: number | null;
  };
  wallet: {
    bal: number;
    pay: {
      amt: number;
      state: DemoPaymentState;
      credited: boolean;
      seed: number;
      code: string;
      expiresAt: number;
    } | null;
  };
  bids: Array<{
    id: number;
    round: number;
    value: number;
    at: number;
    prize: number;
    bonus: number;
    res: "won" | "lost" | null;
    redeemed: boolean;
  }>;
  seq: number;
}

export const lanceDemoSessionsTable = pgTable("lance_demo_sessions", {
  id: text("id").primaryKey(),
  state: jsonb("state").$type<LanceDemoStoredState>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
