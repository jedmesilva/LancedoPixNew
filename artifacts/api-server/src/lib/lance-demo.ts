import { randomBytes, randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  lanceDemoSessionsTable,
  type DemoPaymentState,
  type DemoPhase,
  type LanceDemoStoredState,
  db,
} from "@workspace/db";
import {
  GetLanceDemoStateResponse,
  type LanceDemoActionInput,
  type LanceDemoStateOutput,
} from "@workspace/api-zod";

const PRIZES = [
  { v: 500, b: 18 },
  { v: 1000, b: 36 },
  { v: 2500, b: 90 },
  { v: 10000, b: 360 },
  { v: 50000, b: 1800 },
  { v: 100000, b: 3600 },
  { v: 1000000, b: 36000 },
];
const NAMES = ["Você", "Carlos M.", "Ana P.", "João R."];
const TOTAL = 60;
const START = 60;
const STEP = 0.1;
const BONUS_EVERY_SECONDS = 20;
const BONUS_STEPS = [10, 12, 15, 20, 25, 30, 36];
const PAYMENT_EXPIRY_SECONDS = 600;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type DemoAction = LanceDemoActionInput;
type DemoStateResponse = LanceDemoStateOutput;
type ActionResult = "ok" | "funds" | "invalid" | "exists" | "creds" | "not-found";

const simulationActions = new Set<DemoAction["action"]>([
  "setPrize",
  "setPhase",
  "rivalBid",
  "hurry",
  "setPixState",
]);

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const minBid = (state: LanceDemoStoredState) =>
  roundMoney(state.auction.value + STEP);

function bonusFor(state: LanceDemoStoredState, now: number): number | null {
  const elapsed =
    state.auction.bonusSecs +
    (state.auction.phase === "live" && state.auction.liveSince !== null
      ? Math.max(0, Math.floor((now - state.auction.liveSince) / 1000))
      : 0);
  const index = Math.min(
    BONUS_STEPS.length,
    Math.floor(elapsed / BONUS_EVERY_SECONDS),
  );
  if (index < 1) return null;
  return roundMoney((PRIZES[state.auction.p].b * BONUS_STEPS[index - 1]) / 36);
}

function remainingSeconds(deadline: number | null, fallback: number, now: number) {
  if (deadline === null) return fallback;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function makeInitialState(now: number): LanceDemoStoredState {
  return {
    version: 1,
    user: {
      name: "Marina Costa",
      email: "marina.costa@email.com",
      signedIn: true,
    },
    auction: {
      round: 7,
      p: 1,
      phase: "live",
      value: 12.4,
      leader: 1,
      left: 42,
      soon: START,
      bonusSecs: 0,
      notify: false,
      H: [
        { n: 0, v: 12.3, t: 36 },
        { n: 3, v: 12.2, t: 52 },
        { n: 2, v: 12.1, t: 21 },
        { n: 1, v: 12, t: 44 },
        { n: 0, v: 11.9, t: 58 },
      ],
      deadlineAt: now + 42_000,
      soonAt: null,
      liveSince: now,
    },
    wallet: { bal: 390, pay: null },
    bids: [
      {
        id: 7,
        round: 7,
        value: 12.3,
        at: now - 4 * MINUTE,
        prize: 1000,
        bonus: 0,
        res: null,
        redeemed: false,
      },
      {
        id: 6,
        round: 7,
        value: 11.9,
        at: now - 7 * MINUTE,
        prize: 1000,
        bonus: 0,
        res: null,
        redeemed: false,
      },
      {
        id: 5,
        round: 6,
        value: 38.4,
        at: now - 2 * HOUR - 20 * MINUTE,
        prize: 1000,
        bonus: 15,
        res: "won",
        redeemed: false,
      },
      {
        id: 4,
        round: 6,
        value: 37.6,
        at: now - 2 * HOUR - 26 * MINUTE,
        prize: 1000,
        bonus: 0,
        res: "lost",
        redeemed: false,
      },
      {
        id: 3,
        round: 5,
        value: 22.1,
        at: now - 26 * HOUR,
        prize: 500,
        bonus: 0,
        res: "lost",
        redeemed: false,
      },
      {
        id: 2,
        round: 4,
        value: 17.8,
        at: now - 50 * HOUR,
        prize: 2500,
        bonus: 30,
        res: "won",
        redeemed: true,
      },
      {
        id: 1,
        round: 3,
        value: 9.9,
        at: now - 5 * 24 * HOUR,
        prize: 500,
        bonus: 0,
        res: "lost",
        redeemed: false,
      },
    ],
    seq: 7,
  };
}

function currentBonusSeconds(state: LanceDemoStoredState, now: number) {
  return (
    state.auction.bonusSecs +
    (state.auction.phase === "live" && state.auction.liveSince !== null
      ? Math.max(0, Math.floor((now - state.auction.liveSince) / 1000))
      : 0)
  );
}

function addUserBid(state: LanceDemoStoredState, now: number) {
  state.bids.unshift({
    id: ++state.seq,
    round: state.auction.round,
    value: state.auction.value,
    at: now,
    prize: PRIZES[state.auction.p].v,
    bonus: 0,
    res: null,
    redeemed: false,
  });
}

function carryUserBid(state: LanceDemoStoredState, now: number) {
  if (
    state.auction.leader === 0 &&
    state.auction.phase !== "soon" &&
    !state.bids.some((bid) => bid.round === state.auction.round)
  ) {
    addUserBid(state, now);
  }
}

function advanceTimers(state: LanceDemoStoredState, now: number): boolean {
  let changed = false;
  const auction = state.auction;

  if (auction.phase === "soon" && auction.soonAt !== null && now >= auction.soonAt) {
    const startedAt = auction.soonAt;
    auction.phase = "live";
    auction.soonAt = null;
    auction.deadlineAt = startedAt + TOTAL * 1000;
    auction.liveSince = startedAt;
    auction.left = TOTAL;
    auction.bonusSecs = 0;
    carryUserBid(state, startedAt);
    changed = true;
  }

  if (
    auction.phase === "live" &&
    auction.deadlineAt !== null &&
    now >= auction.deadlineAt
  ) {
    auction.bonusSecs = currentBonusSeconds(state, auction.deadlineAt);
    auction.phase = "ended";
    auction.left = 0;
    auction.deadlineAt = null;
    auction.liveSince = null;
    changed = true;
  }

  const payment = state.wallet.pay;
  if (
    payment?.state === "pending" &&
    now >= payment.expiresAt
  ) {
    payment.state = "expired";
    changed = true;
  }
  return changed;
}

function currentLeft(state: LanceDemoStoredState, now: number) {
  if (state.auction.phase === "ended") return 0;
  return remainingSeconds(
    state.auction.deadlineAt,
    state.auction.left,
    now,
  );
}

function getBids(state: LanceDemoStoredState, now: number) {
  const latest = state.bids.find((bid) => bid.round === state.auction.round);
  return state.bids.map((bid) => {
    if (bid.round !== state.auction.round) {
      return {
        ...bid,
        status: bid.res === "won" ? "won" : "outbid",
      } as const;
    }
    const leading = bid === latest && state.auction.leader === 0;
    const status = !leading
      ? "outbid"
      : state.auction.phase === "ended"
        ? "won"
        : "leading";
    return {
      ...bid,
      prize: PRIZES[state.auction.p].v,
      bonus: status === "won" ? (bonusFor(state, now) ?? 0) : 0,
      status,
    } as const;
  });
}

function toPublicState(
  state: LanceDemoStoredState,
  now: number,
): DemoStateResponse {
  if (state.version !== 1) {
    throw new Error(`Unsupported Lance do Pix demo state version: ${state.version}`);
  }

  const bids = getBids(state, now);
  const currentWin = bids.find(
    (bid) => bid.round === state.auction.round && bid.status === "won",
  );
  const pay = state.wallet.pay;
  const auction = {
    ...state.auction,
    left: currentLeft(state, now),
    soon:
      state.auction.phase === "soon"
        ? remainingSeconds(state.auction.soonAt, state.auction.soon, now)
        : state.auction.soon,
    bonusSecs: currentBonusSeconds(state, now),
    paid: Boolean(currentWin?.redeemed),
    minimumBid: minBid(state),
    bonus: bonusFor(state, now),
  };

  return GetLanceDemoStateResponse.parse({
    cfg: { V: PRIZES, N: NAMES, TOTAL, START, STEP },
    auction,
    wallet: {
      bal: state.wallet.bal,
      pay: pay
        ? {
            amt: pay.amt,
            state: pay.state,
            left:
              pay.state === "pending"
                ? remainingSeconds(pay.expiresAt, PAYMENT_EXPIRY_SECONDS, now)
                : 0,
            credited: pay.credited,
            seed: pay.seed,
            code: pay.code,
          }
        : null,
    },
    user: state.user,
    bids,
    redeemable: bids.filter((bid) => bid.status === "won" && !bid.redeemed).length,
    controlsEnabled: process.env.NODE_ENV !== "production",
  });
}

function pushAuctionHistory(state: LanceDemoStoredState, now: number) {
  state.auction.H.unshift({
    n: state.auction.leader,
    v: state.auction.value,
    t: currentLeft(state, now),
  });
  state.auction.H.length = Math.min(state.auction.H.length, 5);
}

function closeRound(state: LanceDemoStoredState, now: number) {
  const last = state.bids.find((bid) => bid.round === state.auction.round);
  const won = state.auction.phase === "ended" && state.auction.leader === 0;
  for (const bid of state.bids) {
    if (bid.round !== state.auction.round) continue;
    const isWinner = won && bid === last;
    bid.res = isWinner ? "won" : "lost";
    bid.prize = PRIZES[state.auction.p].v;
    bid.bonus = isWinner ? (bonusFor(state, now) ?? 0) : 0;
  }
  state.auction.round += 1;
}

function setPaymentState(
  state: LanceDemoStoredState,
  nextState: DemoPaymentState,
  now: number,
) {
  const payment = state.wallet.pay;
  if (!payment) return false;
  if (payment.credited && nextState !== "paid") {
    state.wallet.bal = roundMoney(state.wallet.bal - payment.amt);
    payment.credited = false;
  }
  if (nextState === "paid" && !payment.credited) {
    state.wallet.bal = roundMoney(state.wallet.bal + payment.amt);
    payment.credited = true;
  }
  if (nextState === "pending") {
    payment.expiresAt = now + PAYMENT_EXPIRY_SECONDS * 1000;
  }
  payment.state = nextState;
  return true;
}

function redeem(state: LanceDemoStoredState, id: number, now: number): boolean {
  if (!state.user.signedIn) return false;
  const bid = getBids(state, now).find((item) => item.id === id);
  if (!bid || bid.status !== "won" || bid.redeemed) return false;
  const storedBid = state.bids.find((item) => item.id === id);
  if (!storedBid) return false;
  storedBid.redeemed = true;
  return true;
}

function createDemoPix(state: LanceDemoStoredState, amount: number, now: number) {
  if (!state.user.signedIn || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return false;
  }
  const id = randomBytes(8).toString("hex").toUpperCase();
  state.wallet.pay = {
    amt: roundMoney(amount),
    state: "pending",
    expiresAt: now + PAYMENT_EXPIRY_SECONDS * 1000,
    credited: false,
    seed: Number.parseInt(id.slice(0, 8), 16),
    code:
      "00020126580014BR.GOV.BCB.PIX0136" +
      id +
      "5204000053039865802BR5913LANCE DO PIX6009SAO PAULO6304" +
      id.slice(0, 4),
  };
  return true;
}

function startNextRound(state: LanceDemoStoredState, now: number) {
  if (state.auction.phase !== "soon") closeRound(state, now);
  state.auction.phase = "soon";
  state.auction.left = TOTAL;
  state.auction.soon = START;
  state.auction.soonAt = now + START * 1000;
  state.auction.deadlineAt = null;
  state.auction.liveSince = null;
  state.auction.bonusSecs = 0;
  state.auction.notify = false;
}

function runAction(
  state: LanceDemoStoredState,
  action: DemoAction,
  now: number,
): ActionResult {
  const auction = state.auction;

  switch (action.action) {
    case "bid": {
      const amount = action.amount;
      if (
        !state.user.signedIn ||
        auction.phase !== "live" ||
        auction.leader === 0 ||
        amount === undefined ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1_000_000
      ) {
        return "invalid";
      }
      const value = roundMoney(amount);
      if (value < minBid(state)) return "invalid";
      if (state.wallet.bal < value) return "funds";
      state.wallet.bal = roundMoney(state.wallet.bal - value);
      pushAuctionHistory(state, now);
      auction.value = value;
      auction.leader = 0;
      auction.left = TOTAL;
      auction.deadlineAt = now + TOTAL * 1000;
      if (auction.liveSince === null) auction.liveSince = now;
      addUserBid(state, now);
      return "ok";
    }
    case "nextRound":
      startNextRound(state, now);
      return "ok";
    case "notifyStart":
      if (auction.phase !== "soon") return "invalid";
      auction.notify = true;
      return "ok";
    case "requestPayout": {
      const winningBid = getBids(state, now).find(
        (bid) => bid.round === auction.round && bid.status === "won",
      );
      return winningBid && redeem(state, winningBid.id, now) ? "ok" : "invalid";
    }
    case "redeem":
      return action.bidId !== undefined && redeem(state, action.bidId, now)
        ? "ok"
        : "not-found";
    case "logout":
      state.user.signedIn = false;
      return "ok";
    case "updateName": {
      const name = action.name?.trim();
      if (!state.user.signedIn || !name || name.length < 2 || name.length > 80) {
        return "invalid";
      }
      state.user.name = name;
      return "ok";
    }
    case "createPix":
      return action.amount !== undefined && createDemoPix(state, action.amount, now)
        ? "ok"
        : "invalid";
    case "discardPix":
      state.wallet.pay = null;
      return "ok";
    case "setPixState":
      return action.paymentState &&
        setPaymentState(state, action.paymentState, now)
        ? "ok"
        : "invalid";
    case "setPrize":
      if (
        action.prizeIndex === undefined ||
        action.prizeIndex < 0 ||
        action.prizeIndex >= PRIZES.length
      ) {
        return "invalid";
      }
      auction.p = action.prizeIndex;
      return "ok";
    case "setPhase": {
      const phase = action.phase;
      if (!phase) return "invalid";
      const leftBefore = currentLeft(state, now);
      const bonusBefore = currentBonusSeconds(state, now);
      if (phase === "soon" && auction.phase !== "soon") closeRound(state, now);
      auction.phase = phase;
      if (phase === "ended") {
        auction.left = 0;
        auction.deadlineAt = null;
        auction.soonAt = null;
        auction.bonusSecs = bonusBefore;
        auction.liveSince = null;
      } else if (phase === "soon") {
        auction.left = TOTAL;
        auction.soon = START;
        auction.soonAt = now + START * 1000;
        auction.deadlineAt = null;
        auction.liveSince = null;
        auction.bonusSecs = 0;
      } else if (phase === "paused") {
        auction.left = leftBefore;
        auction.bonusSecs = bonusBefore;
        auction.deadlineAt = null;
        auction.soonAt = null;
        auction.liveSince = null;
      } else {
        if (auction.left <= 0) auction.left = TOTAL;
        auction.deadlineAt = now + auction.left * 1000;
        auction.soonAt = null;
        auction.liveSince = now;
      }
      carryUserBid(state, now);
      return "ok";
    }
    case "rivalBid":
      if (auction.phase !== "live" || auction.leader === 0) return "invalid";
      pushAuctionHistory(state, now);
      auction.value = roundMoney(auction.value + STEP);
      auction.leader = (auction.leader % (NAMES.length - 1)) + 1;
      auction.left = TOTAL;
      auction.deadlineAt = now + TOTAL * 1000;
      if (auction.liveSince === null) auction.liveSince = now;
      return "ok";
    case "hurry":
      if (auction.phase !== "live") return "invalid";
      auction.deadlineAt = now + Math.min(currentLeft(state, now), 5) * 1000;
      return "ok";
    case "demoSignIn": {
      const email = action.email?.trim().toLowerCase();
      if (email !== "marina.costa@email.com") return "creds";
      state.user = {
        name: "Marina Costa",
        email,
        signedIn: true,
      };
      return "ok";
    }
    case "demoSignUp": {
      const name = action.name?.trim();
      const email = action.email?.trim().toLowerCase();
      if (!name || name.length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return "invalid";
      }
      if (email === "marina.costa@email.com") return "exists";
      state.user = { name, email, signedIn: true };
      return "ok";
    }
    case "demoGoogle":
      state.user = {
        name: "Marina Costa",
        email: "marina.costa@gmail.com",
        signedIn: true,
      };
      return "ok";
    case "demoReset":
      return "ok";
  }
  return "invalid";
}

async function withSession<T>(
  sessionId: string,
  run: (
    state: LanceDemoStoredState,
    now: number,
  ) => { result: T; shouldPersist: boolean },
) {
  const createdAt = new Date();
  await db
    .insert(lanceDemoSessionsTable)
    .values({ id: sessionId, state: makeInitialState(createdAt.getTime()) })
    .onConflictDoNothing();

  return db.transaction(async (transaction) => {
    const [row] = await transaction
      .select()
      .from(lanceDemoSessionsTable)
      .where(eq(lanceDemoSessionsTable.id, sessionId))
      .for("update");
    if (!row) throw new Error("Lance do Pix demo session could not be loaded");

    const state = structuredClone(row.state);
    const now = Date.now();
    const timerChanged = advanceTimers(state, now);
    const { result, shouldPersist } = run(state, now);
    if (timerChanged || shouldPersist) {
      await transaction
        .update(lanceDemoSessionsTable)
        .set({ state, updatedAt: new Date(now) })
        .where(eq(lanceDemoSessionsTable.id, sessionId));
    }
    return { result, state: toPublicState(state, now) };
  });
}

export function isSimulationAction(action: DemoAction["action"]) {
  return simulationActions.has(action);
}

export async function getLanceDemoState(sessionId: string) {
  const { state } = await withSession(sessionId, () => ({
    result: undefined,
    shouldPersist: false,
  }));
  return state;
}

export async function applyLanceDemoAction(
  sessionId: string,
  action: DemoAction,
) {
  return withSession(sessionId, (state, now) => ({
    result: runAction(state, action, now),
    shouldPersist: true,
  }));
}
