import {
  createCipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import {
  ApiErrorBody,
  GetLanceStateResponse,
  type LanceActionInput,
  type LanceStateOutput,
} from "@workspace/api-zod";
import {
  bidsTable,
  bonusesTable,
  creditTopupsTable,
  db,
  disputesTable,
  payoutEventsTable,
  payoutRequestsTable,
  prizeTiersTable,
  userSessionsTable,
  usersTable,
  walletEntriesTable,
  walletsTable,
} from "@workspace/db";
import type { CurrentUser } from "./auth";

const TOTAL = 60;
const START = 60;
const PAYMENT_EXPIRY_SECONDS = 600;
const MAX_AMOUNT_CENTS = 100_000_000;
const INITIAL_TIER_ID = 2;
const LOCK_ID = 781_927;
const ACTIVE_STATUSES = ["scheduled", "live", "paused"] as const;
const PAYMENT_STATES = ["pending", "paid", "expired", "failed"] as const;
type PaymentState = (typeof PAYMENT_STATES)[number];
type ActionResult = "ok" | "funds" | "invalid" | "exists" | "creds" | "not-found";

const prizeValues = [
  50_000n,
  100_000n,
  250_000n,
  1_000_000n,
  5_000_000n,
  10_000_000n,
  100_000_000n,
];

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const centsToMoney = (value: bigint) => Number(value) / 100;
const millisecondsLeft = (date: Date, now: number) =>
  Math.max(0, Math.ceil((date.getTime() - now) / 1000));

async function ensureInitialDispute() {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ID})`);

    const [existing] = await transaction
      .select()
      .from(disputesTable)
      .orderBy(desc(disputesTable.number))
      .limit(1);
    if (existing) return existing;

    await transaction
      .insert(prizeTiersTable)
      .values(
        prizeValues.map((prizeCents, index) => ({
          id: index + 1,
          prizeCents,
          active: true,
        })),
      )
      .onConflictDoNothing();

    const now = new Date();
    const [dispute] = await transaction
      .insert(disputesTable)
      .values({
        number: 1,
        tierId: INITIAL_TIER_ID,
        prizeCents: prizeValues[INITIAL_TIER_ID - 1],
        startingValueCents: 0n,
        stepCents: 10n,
        bidDurationS: TOTAL,
        status: "live",
        startsAt: now,
        startedAt: now,
      })
      .returning();
    return dispute;
  });
}

async function advanceDispute() {
  const now = new Date();
  await db.transaction(async (transaction) => {
    const [dispute] = await transaction
      .select()
      .from(disputesTable)
      .where(inArray(disputesTable.status, [...ACTIVE_STATUSES]))
      .orderBy(desc(disputesTable.number))
      .limit(1)
      .for("update");
    if (!dispute) return;

    if (dispute.status === "scheduled" && dispute.startsAt <= now) {
      await transaction
        .update(disputesTable)
        .set({ status: "live", startedAt: now })
        .where(eq(disputesTable.id, dispute.id));
      return;
    }

    if (dispute.status !== "live" || !dispute.leaderBidId) return;

    const [leader] = await transaction
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.id, dispute.leaderBidId))
      .limit(1);
    if (!leader || leader.expiresAt > now) return;

    await transaction
      .update(bidsTable)
      .set({ result: "lost" })
      .where(eq(bidsTable.disputeId, dispute.id));
    await transaction
      .update(bidsTable)
      .set({ result: "won" })
      .where(eq(bidsTable.id, leader.id));
    await transaction
      .update(disputesTable)
      .set({
        status: "ended",
        endedAt: now,
        winnerId: leader.userId,
      })
      .where(eq(disputesTable.id, dispute.id));
  });
}

function encryptionKey() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET is required.");
  return Buffer.from(
    hkdfSync(
      "sha256",
      sessionSecret,
      Buffer.from("lance-do-pix-payouts"),
      Buffer.from("payout-personal-data-v1"),
      32,
    ),
  );
}

function encryptSensitiveValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digitAt = (length: number, factor: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (factor - i);
    const digit = (sum * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  return digitAt(9, 10) === Number(cpf[9]) && digitAt(10, 11) === Number(cpf[10]);
}

function inferPixKeyType(key: string) {
  const normalized = key.trim();
  const digits = normalized.replace(/\D/g, "");
  if (validCpf(normalized)) return "cpf" as const;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return "email" as const;
  if (/^\+?[\d\s().-]{10,20}$/.test(normalized) && digits.length >= 10 && digits.length <= 13) {
    return "phone" as const;
  }
  if (/^[a-f0-9-]{32,36}$/i.test(normalized)) return "random" as const;
  return null;
}

async function getState(user: CurrentUser | null): Promise<LanceStateOutput> {
  await ensureInitialDispute();
  await advanceDispute();
  const now = Date.now();

  const [dispute] = await db
    .select()
    .from(disputesTable)
    .where(inArray(disputesTable.status, [...ACTIVE_STATUSES]))
    .orderBy(desc(disputesTable.number))
    .limit(1);
  const [latest] = dispute
    ? [dispute]
    : await db
        .select()
        .from(disputesTable)
        .orderBy(desc(disputesTable.number))
        .limit(1);

  const tiers = await db
    .select()
    .from(prizeTiersTable)
    .where(eq(prizeTiersTable.active, true))
    .orderBy(asc(prizeTiersTable.id));
  const currentBids = await db
    .select({
      id: bidsTable.id,
      userId: bidsTable.userId,
      valueCents: bidsTable.valueCents,
      createdAt: bidsTable.createdAt,
      publicName: usersTable.publicName,
    })
    .from(bidsTable)
    .innerJoin(usersTable, eq(bidsTable.userId, usersTable.id))
    .where(eq(bidsTable.disputeId, latest.id))
    .orderBy(desc(bidsTable.valueCents), desc(bidsTable.createdAt))
    .limit(30);

  const nameIndexes = new Map<string, number>();
  const names = ["Você"];
  const nameIndex = (userId: string, publicName: string) => {
    if (user?.id === userId) return 0;
    const existing = nameIndexes.get(userId);
    if (existing !== undefined) return existing;
    const index = names.length;
    names.push(publicName);
    nameIndexes.set(userId, index);
    return index;
  };

  const leader = currentBids[0] ?? null;
  const previousBids = currentBids.slice(1, 6);
  const history = previousBids.map((bid, index) => {
    const newerBid = currentBids[index];
    const elapsed =
      newerBid && bid.createdAt
        ? Math.max(
            0,
            Math.floor(
              (newerBid.createdAt.getTime() - bid.createdAt.getTime()) / 1000,
            ),
          )
        : 0;
    return {
      n: nameIndex(bid.userId, bid.publicName),
      v: centsToMoney(bid.valueCents),
      t: elapsed,
    };
  });
  if (leader) nameIndex(leader.userId, leader.publicName);

  const phase =
    latest.status === "scheduled"
      ? "soon"
      : latest.status === "paused"
        ? "paused"
        : latest.status === "ended"
          ? "ended"
          : "live";
  const left =
    phase === "live" && leader
      ? millisecondsLeft(leader.createdAt && latest.bidDurationS
          ? new Date(leader.createdAt.getTime() + latest.bidDurationS * 1000)
          : new Date(now), now)
      : 0;
  const soon = phase === "soon" ? millisecondsLeft(latest.startsAt, now) : START;
  const valueCents = leader?.valueCents ?? latest.startingValueCents;
  const tierIndex = Math.max(
    0,
    tiers.findIndex((tier) => tier.id === latest.tierId),
  );

  let balanceCents = 0n;
  let payment: LanceStateOutput["wallet"]["pay"] = null;
  if (user) {
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, user.id))
      .limit(1);
    balanceCents = wallet?.balanceCents ?? 0n;

    const [topup] = await db
      .select()
      .from(creditTopupsTable)
      .where(eq(creditTopupsTable.userId, user.id))
      .orderBy(desc(creditTopupsTable.createdAt))
      .limit(1);
    if (topup?.status === "pending" && topup.expiresAt.getTime() <= now) {
      await db
        .update(creditTopupsTable)
        .set({ status: "expired", updatedAt: new Date(now) })
        .where(eq(creditTopupsTable.id, topup.id));
      topup.status = "expired";
    }
    if (topup) {
      payment = {
        id: topup.id,
        amt: centsToMoney(topup.amountCents),
        state: topup.status as PaymentState,
        left:
          topup.status === "pending"
            ? millisecondsLeft(topup.expiresAt, now)
            : 0,
        credited: topup.status === "paid",
        seed: 0,
        code: "SIMULADO",
      };
    }
  }

  const ownRows = user
    ? await db
        .select({
          id: bidsTable.id,
          disputeId: disputesTable.id,
          round: disputesTable.number,
          valueCents: bidsTable.valueCents,
          createdAt: bidsTable.createdAt,
          prizeCents: disputesTable.prizeCents,
          result: bidsTable.result,
          leaderBidId: disputesTable.leaderBidId,
          disputeStatus: disputesTable.status,
        })
        .from(bidsTable)
        .innerJoin(disputesTable, eq(bidsTable.disputeId, disputesTable.id))
        .where(eq(bidsTable.userId, user.id))
        .orderBy(desc(bidsTable.createdAt))
        .limit(50)
    : [];
  const ownBidIds = ownRows.map((bid) => bid.id);
  const payoutBidIds = ownBidIds.length
    ? await db
        .select({ bidId: payoutRequestsTable.bidId })
        .from(payoutRequestsTable)
        .where(inArray(payoutRequestsTable.bidId, ownBidIds))
    : [];
  const redeemedIds = new Set(payoutBidIds.map((row) => row.bidId));
  const bids = ownRows.map((bid) => {
    const isLeader =
      bid.disputeId === latest.id && bid.leaderBidId === bid.id;
    const result =
      bid.result === "won" ? "won" : bid.result === "lost" ? "lost" : null;
    const status =
      bid.disputeStatus === "ended"
        ? result === "won"
          ? "won"
          : "outbid"
        : isLeader
          ? "leading"
          : "outbid";
    return {
      id: bid.id,
      round: bid.round,
      value: centsToMoney(bid.valueCents),
      at: bid.createdAt.getTime(),
      prize: centsToMoney(bid.prizeCents),
      bonus: 0,
      res: result,
      redeemed: redeemedIds.has(bid.id),
      status,
    } as const;
  });
  const redeemable = bids.filter(
    (bid) => bid.status === "won" && !bid.redeemed,
  ).length;

  const payoutForLeader = leader
    ? await db
        .select({ id: payoutRequestsTable.id })
        .from(payoutRequestsTable)
        .where(
          and(
            eq(payoutRequestsTable.bidId, leader.id),
            sql`${payoutRequestsTable.status} <> 'rejected'`,
          ),
        )
        .limit(1)
    : [];
  const bonusRows = await db
    .select({ amountCents: bonusesTable.amountCents })
    .from(bonusesTable)
    .where(eq(bonusesTable.disputeId, latest.id));
  const bonusCents = bonusRows.reduce((sum, row) => sum + row.amountCents, 0n);

  return GetLanceStateResponse.parse({
    cfg: {
      V: tiers.map((tier) => ({ v: centsToMoney(tier.prizeCents), b: 0 })),
      N: names,
      TOTAL: latest.bidDurationS,
      START,
      STEP: centsToMoney(latest.stepCents),
    },
    auction: {
      round: latest.number,
      p: tierIndex,
      phase,
      value: centsToMoney(valueCents),
      leader: leader ? nameIndex(leader.userId, leader.publicName) : -1,
      left,
      soon,
      bonusSecs: 0,
      notify: false,
      H: history,
      paid: payoutForLeader.length > 0,
      minimumBid: centsToMoney(valueCents + latest.stepCents),
      bonus: bonusCents > 0n ? centsToMoney(bonusCents) : null,
    },
    wallet: { bal: centsToMoney(balanceCents), pay: payment },
    user: {
      id: user?.id ?? null,
      name: user?.name ?? "",
      email: user?.email ?? "",
      signedIn: Boolean(user),
      testAccount: user?.testAccount ?? false,
    },
    bids,
    redeemable,
    controlsEnabled: false,
  });
}

async function getLatestActiveTopup(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  const [topup] = await transaction
    .select()
    .from(creditTopupsTable)
    .where(
      and(
        eq(creditTopupsTable.userId, userId),
        eq(creditTopupsTable.status, "pending"),
      ),
    )
    .orderBy(desc(creditTopupsTable.createdAt))
    .limit(1)
    .for("update");
  return topup;
}

async function placeBid(userId: string, amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT_CENTS / 100) {
    return "invalid";
  }
  const bidValueCents = BigInt(Math.round(amount * 100));
  const now = new Date();

  return db.transaction(async (transaction) => {
    const [dispute] = await transaction
      .select()
      .from(disputesTable)
      .where(inArray(disputesTable.status, [...ACTIVE_STATUSES]))
      .orderBy(desc(disputesTable.number))
      .limit(1)
      .for("update");
    if (!dispute || dispute.status !== "live") return "invalid";

    if (dispute.leaderBidId) {
      const [leader] = await transaction
        .select()
        .from(bidsTable)
        .where(eq(bidsTable.id, dispute.leaderBidId))
        .limit(1)
        .for("update");
      if (leader && leader.expiresAt <= now) {
        await transaction
          .update(bidsTable)
          .set({ result: "lost" })
          .where(eq(bidsTable.disputeId, dispute.id));
        await transaction
          .update(bidsTable)
          .set({ result: "won" })
          .where(eq(bidsTable.id, leader.id));
        await transaction
          .update(disputesTable)
          .set({
            status: "ended",
            endedAt: now,
            winnerId: leader.userId,
          })
          .where(eq(disputesTable.id, dispute.id));
        return "invalid";
      }
    }

    const currentValue =
      dispute.leaderBidId === null
        ? dispute.startingValueCents
        : (
            await transaction
              .select({ valueCents: bidsTable.valueCents })
              .from(bidsTable)
              .where(eq(bidsTable.id, dispute.leaderBidId))
              .limit(1)
          )[0]?.valueCents ?? dispute.startingValueCents;
    if (bidValueCents < currentValue + dispute.stepCents) return "invalid";

    const [wallet] = await transaction
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1)
      .for("update");
    if (!wallet || wallet.balanceCents < bidValueCents) return "funds";

    const newBalance = wallet.balanceCents - bidValueCents;
    await transaction
      .update(walletsTable)
      .set({ balanceCents: newBalance, updatedAt: now })
      .where(eq(walletsTable.userId, userId));
    const [entry] = await transaction
      .insert(walletEntriesTable)
      .values({
        userId,
        type: "bid",
        amountCents: -bidValueCents,
        balanceAfterCents: newBalance,
        refType: "manual",
      })
      .returning();
    const expiresAt = new Date(now.getTime() + dispute.bidDurationS * 1000);
    const [bid] = await transaction
      .insert(bidsTable)
      .values({
        disputeId: dispute.id,
        userId,
        valueCents: bidValueCents,
        costCents: bidValueCents,
        walletEntryId: entry.id,
        expiresAt,
      })
      .returning();
    await transaction
      .update(walletEntriesTable)
      .set({ refType: "bid", refId: bid.id })
      .where(eq(walletEntriesTable.id, entry.id));
    await transaction
      .update(disputesTable)
      .set({
        leaderBidId: bid.id,
        bidsCount: sql`${disputesTable.bidsCount} + 1`,
        bidsTotalCents: sql`${disputesTable.bidsTotalCents} + ${bidValueCents}`,
      })
      .where(eq(disputesTable.id, dispute.id));
    return "ok";
  });
}

async function createCreditTopup(
  userId: string,
  amount: number,
): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT_CENTS / 100) {
    return "invalid";
  }
  const amountCents = BigInt(Math.round(amount * 100));
  if (amountCents <= 0n || amountCents > BigInt(MAX_AMOUNT_CENTS)) {
    return "invalid";
  }

  return db.transaction(async (transaction) => {
    const active = await getLatestActiveTopup(transaction, userId);
    const now = new Date();
    if (active && active.expiresAt > now) return "exists";
    if (active) {
      await transaction
        .update(creditTopupsTable)
        .set({ status: "expired", updatedAt: now })
        .where(eq(creditTopupsTable.id, active.id));
    }

    const txid = `SIM-${randomUUID()}`;
    await transaction.insert(creditTopupsTable).values({
      userId,
      amountCents,
      status: "pending",
      txid,
      pixCopyPaste: "SIMULACAO-SEM-PIX",
      expiresAt: new Date(now.getTime() + PAYMENT_EXPIRY_SECONDS * 1000),
    });
    return "ok";
  });
}

async function changeSimulatedTopupState(
  userId: string,
  nextState: PaymentState,
): Promise<ActionResult> {
  if (nextState === "pending" || !PAYMENT_STATES.includes(nextState)) {
    return "invalid";
  }

  return db.transaction(async (transaction) => {
    const topup = await getLatestActiveTopup(transaction, userId);
    if (!topup) return "not-found";

    const now = new Date();
    if (topup.expiresAt <= now && nextState === "paid") {
      await transaction
        .update(creditTopupsTable)
        .set({ status: "expired", updatedAt: now })
        .where(eq(creditTopupsTable.id, topup.id));
      return "invalid";
    }

    if (nextState === "paid") {
      const [wallet] = await transaction
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .limit(1)
        .for("update");
      if (!wallet) return "invalid";
      const newBalance = wallet.balanceCents + topup.amountCents;
      await transaction
        .update(walletsTable)
        .set({ balanceCents: newBalance, updatedAt: now })
        .where(eq(walletsTable.userId, userId));
      const [entry] = await transaction
        .insert(walletEntriesTable)
        .values({
          userId,
          type: "topup",
          amountCents: topup.amountCents,
          balanceAfterCents: newBalance,
          refType: "credit_topup",
          refId: topup.id,
        })
        .returning();
      await transaction
        .update(creditTopupsTable)
        .set({
          status: "paid",
          paidAt: now,
          walletEntryId: entry.id,
          updatedAt: now,
        })
        .where(eq(creditTopupsTable.id, topup.id));
      return "ok";
    }

    await transaction
      .update(creditTopupsTable)
      .set({ status: nextState, updatedAt: now })
      .where(eq(creditTopupsTable.id, topup.id));
    return "ok";
  });
}

async function discardPendingTopup(userId: string): Promise<ActionResult> {
  return db.transaction(async (transaction) => {
    const topup = await getLatestActiveTopup(transaction, userId);
    if (!topup) return "not-found";
    await transaction
      .update(creditTopupsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(creditTopupsTable.id, topup.id));
    return "ok";
  });
}

async function requestPayout(
  userId: string,
  action: LanceActionInput,
): Promise<ActionResult> {
  const bidId = action.bidId;
  const pixKey = action.pixKey?.trim();
  const holderName = action.holderName?.trim();
  const cpfDigits = action.cpf?.replace(/\D/g, "") ?? "";
  const keyType = pixKey ? inferPixKeyType(pixKey) : null;
  if (
    !bidId ||
    !pixKey ||
    !keyType ||
    !holderName ||
    holderName.split(/\s+/).length < 2 ||
    !validCpf(cpfDigits)
  ) {
    return "invalid";
  }

  const key = encryptionKey();
  const cpfHash = createHmac("sha256", key).update(cpfDigits).digest();
  return db.transaction(async (transaction) => {
    const [bid] = await transaction
      .select()
      .from(bidsTable)
      .where(and(eq(bidsTable.id, bidId), eq(bidsTable.userId, userId)))
      .limit(1)
      .for("update");
    if (!bid || bid.result !== "won") return "not-found";

    const [existing] = await transaction
      .select({ id: payoutRequestsTable.id })
      .from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.bidId, bid.id))
      .limit(1);
    if (existing) return "exists";

    const [dispute] = await transaction
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.id, bid.disputeId))
      .limit(1);
    if (!dispute) return "not-found";

    const [request] = await transaction
      .insert(payoutRequestsTable)
      .values({
        bidId: bid.id,
        userId,
        prizeCents: dispute.prizeCents,
        bonusCents: 0n,
        amountCents: dispute.prizeCents,
        keyType,
        pixKeyEncrypted: encryptSensitiveValue(pixKey),
        holderName,
        cpfEncrypted: encryptSensitiveValue(cpfDigits),
        cpfHash,
        status: "requested",
      })
      .returning();
    await transaction.insert(payoutEventsTable).values({
      payoutId: request.id,
      status: "requested",
      note: "Solicitação de resgate registrada. A transferência Pix depende de processamento manual.",
      author: `user:${userId}`,
      visibleToUser: true,
    });
    return "ok";
  });
}

async function applyAction(
  user: CurrentUser | null,
  action: LanceActionInput,
): Promise<ActionResult> {
  switch (action.action) {
    case "bid":
      return user && action.amount !== undefined
        ? placeBid(user.id, action.amount)
        : "invalid";
    case "createPix":
      return user && action.amount !== undefined
        ? createCreditTopup(user.id, action.amount)
        : "invalid";
    case "discardPix":
      return user ? discardPendingTopup(user.id) : "invalid";
    case "setPixState":
      return user && action.paymentState
        ? changeSimulatedTopupState(user.id, action.paymentState)
        : "invalid";
    case "redeem":
      return user ? requestPayout(user.id, action) : "invalid";
    case "updateName":
      if (!user || !action.name?.trim()) return "invalid";
      await db
        .update(usersTable)
        .set({
          name: action.name.trim(),
          publicName: action.name.trim(),
        })
        .where(eq(usersTable.id, user.id));
      return "ok";
  }
  return "invalid";
}

export async function getLanceState(user: CurrentUser | null) {
  return getState(user);
}

export async function applyLanceAction(
  user: CurrentUser | null,
  action: LanceActionInput,
) {
  const result = await applyAction(user, action);
  const state = await getState(user);
  return { result, state };
}
