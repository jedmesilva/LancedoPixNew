import { randomUUID } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  sql,
} from "drizzle-orm";
import {
  type AutomationMode,
  automationConfigTable,
  automationEventsTable,
  bidsTable,
  db,
  disputesTable,
  treasuryLedgerEntriesTable,
  usersTable,
  walletEntriesTable,
  walletsTable,
} from "@workspace/db";
import { getDisputeDeadline, getDisputeCountdownDeadline } from "./dispute-progression";
import { getAutomationBidAction } from "./automation-mode";
import { recordBidAllocation, recordLedgerEntry, updatePrizeCoverage } from "./treasury";

const CONFIG_ID = 1;
const BOT_NAME = "Bot oficial do Lance do Pix";
const BOT_EMAIL_DOMAIN = "example.invalid";
const DEFAULT_CONFIG = {
  enabled: false,
  mode: "counterbids_only" as const,
  maxBidCents: 0n,
  perDisputeLimitCents: 0n,
  dailyLimitCents: 0n,
  maxBidsPerDispute: 0,
  minimumSecondsRemaining: 10,
  minimumDelaySeconds: 5,
};

type AutomationInput = {
  enabled: boolean;
  mode: AutomationMode;
  maxBidCents: number;
  perDisputeLimitCents: number;
  dailyLimitCents: number;
  maxBidsPerDispute: number;
  minimumSecondsRemaining: number;
  minimumDelaySeconds: number;
};

type FundingInput = {
  amountCents: number;
  receiptReference: string;
  cashReceived: true;
};

function safeNumber(value: bigint | number | null | undefined): number {
  const result = typeof value === "bigint" ? Number(value) : (value ?? 0);
  if (!Number.isSafeInteger(result)) {
    throw new Error("A quantia excede o limite numérico seguro da API.");
  }
  return result;
}

async function ensureConfigRow(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await transaction
    .insert(automationConfigTable)
    .values({ id: CONFIG_ID })
    .onConflictDoNothing();
  const [config] = await transaction
    .select()
    .from(automationConfigTable)
    .where(eq(automationConfigTable.id, CONFIG_ID))
    .for("update");
  return config;
}

export async function getAutomationConfig() {
  const [config] = await db
    .select()
    .from(automationConfigTable)
    .where(eq(automationConfigTable.id, CONFIG_ID))
    .limit(1);

  let botName = BOT_NAME;
  let botExists = false;
  let botWalletBalanceCents = 0n;
  if (config?.botUserId) {
    const [bot] = await db
      .select({
        name: usersTable.publicName,
        testAccount: usersTable.testAccount,
        balance: walletsTable.balanceCents,
      })
      .from(usersTable)
      .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
      .where(eq(usersTable.id, config.botUserId))
      .limit(1);
    if (bot) {
      botExists = !bot.testAccount;
      botName = bot.name;
      botWalletBalanceCents = bot.balance ?? 0n;
    }
  }

  const values = config ?? DEFAULT_CONFIG;
  const blockedReasons: string[] = [];
  if (!botExists) blockedReasons.push("A carteira identificada do bot ainda não foi criada.");
  else if (botWalletBalanceCents <= 0n) {
    blockedReasons.push("A carteira do bot está sem saldo confirmado.");
  }
  if (
    values.maxBidCents <= 0n ||
    values.perDisputeLimitCents <= 0n ||
    values.dailyLimitCents <= 0n ||
    values.maxBidsPerDispute <= 0
  ) {
    blockedReasons.push("Defina limites positivos por lance, disputa, dia e quantidade.");
  }
  if (
    values.maxBidCents > values.perDisputeLimitCents ||
    values.perDisputeLimitCents > values.dailyLimitCents
  ) {
    blockedReasons.push("Os limites devem seguir a ordem: lance, disputa e dia.");
  }

  return {
    enabled: values.enabled,
    mode: values.mode,
    botExists,
    botName,
    botWalletBalanceCents: safeNumber(botWalletBalanceCents),
    maxBidCents: safeNumber(values.maxBidCents),
    perDisputeLimitCents: safeNumber(values.perDisputeLimitCents),
    dailyLimitCents: safeNumber(values.dailyLimitCents),
    maxBidsPerDispute: values.maxBidsPerDispute,
    minimumSecondsRemaining: values.minimumSecondsRemaining,
    minimumDelaySeconds: values.minimumDelaySeconds,
    canEnable: blockedReasons.length === 0,
    blockedReasons,
    updatedAt: config?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAutomationConfig(input: AutomationInput) {
  if (
    input.maxBidCents > input.perDisputeLimitCents ||
    input.perDisputeLimitCents > input.dailyLimitCents
  ) {
    throw new Error("LIMIT_ORDER_INVALID");
  }

  await db.transaction(async (transaction) => {
    const current = await ensureConfigRow(transaction);
    if (!current) throw new Error("AUTOMATION_CONFIG_UNAVAILABLE");

    if (input.enabled) {
      if (!current.botUserId) throw new Error("BOT_NOT_FUNDED");
      const [wallet] = await transaction
        .select({ balanceCents: walletsTable.balanceCents })
        .from(walletsTable)
        .where(eq(walletsTable.userId, current.botUserId))
        .for("update");
      if (!wallet || wallet.balanceCents <= 0n) {
        throw new Error("BOT_NOT_FUNDED");
      }
      if (
        input.maxBidCents <= 0 ||
        input.perDisputeLimitCents <= 0 ||
        input.dailyLimitCents <= 0 ||
        input.maxBidsPerDispute <= 0
      ) {
        throw new Error("LIMITS_REQUIRED");
      }
    }

    await transaction
      .update(automationConfigTable)
      .set({
        enabled: input.enabled,
        mode: input.mode,
        maxBidCents: BigInt(input.maxBidCents),
        perDisputeLimitCents: BigInt(input.perDisputeLimitCents),
        dailyLimitCents: BigInt(input.dailyLimitCents),
        maxBidsPerDispute: input.maxBidsPerDispute,
        minimumSecondsRemaining: input.minimumSecondsRemaining,
        minimumDelaySeconds: input.minimumDelaySeconds,
        updatedAt: new Date(),
      })
      .where(eq(automationConfigTable.id, CONFIG_ID));

    const now = new Date();
    await transaction.insert(automationEventsTable).values({
      eventType: "config_updated",
      botUserId: current.botUserId,
      summary: "O modo, as regras e os limites da automação foram atualizados.",
      createdAt: now,
    });
    if (current.enabled !== input.enabled) {
      await transaction.insert(automationEventsTable).values({
        eventType: input.enabled ? "enabled" : "disabled",
        botUserId: current.botUserId,
        summary: input.enabled
          ? "A automação de lances foi ligada."
          : "A automação de lances foi desligada.",
        createdAt: now,
      });
    }
  });

  return getAutomationConfig();
}

export async function recordAutomationFunding(input: FundingInput) {
  if (input.cashReceived !== true) throw new Error("CASH_NOT_CONFIRMED");
  const amountCents = BigInt(input.amountCents);
  const receiptReference = input.receiptReference.trim();
  if (receiptReference.length < 3) throw new Error("INVALID_RECEIPT_REFERENCE");

  return db.transaction(async (transaction) => {
    const [existingReceipt] = await transaction
      .select({ id: automationEventsTable.id })
      .from(automationEventsTable)
      .where(eq(automationEventsTable.receiptReference, receiptReference))
      .limit(1);
    if (existingReceipt) throw new Error("RECEIPT_REFERENCE_USED");

    const config = await ensureConfigRow(transaction);
    if (!config) throw new Error("AUTOMATION_CONFIG_UNAVAILABLE");

    let botUserId = config.botUserId;
    if (!botUserId) {
      botUserId = randomUUID();
      await transaction.insert(usersTable).values({
        id: botUserId,
        name: BOT_NAME,
        publicName: BOT_NAME,
        email: `lancebot+${botUserId}@${BOT_EMAIL_DOMAIN}`,
        passwordHash: null,
        testAccount: false,
      });
      await transaction.insert(walletsTable).values({
        userId: botUserId,
        balanceCents: 0n,
      });
      await transaction
        .update(automationConfigTable)
        .set({ botUserId, updatedAt: new Date() })
        .where(eq(automationConfigTable.id, CONFIG_ID));
    }

    const [wallet] = await transaction
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, botUserId))
      .for("update");
    if (!wallet) throw new Error("BOT_WALLET_UNAVAILABLE");

    const newBalance = wallet.balanceCents + amountCents;
    await transaction
      .update(walletsTable)
      .set({ balanceCents: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.userId, botUserId));
    await transaction.insert(walletEntriesTable).values({
      userId: botUserId,
      type: "adjustment",
      amountCents,
      balanceAfterCents: newBalance,
      refType: "manual",
      refId: null,
    });

    const sourceId = `automation-funding:${receiptReference}`;
    await recordLedgerEntry(transaction, {
      entryType: "cash_receipt",
      amountCents,
      sourceType: "automation_funding",
      sourceId,
      idempotencyKey: `${sourceId}:cash-receipt`,
      userId: botUserId,
      simulated: false,
      metadata: { receiptReference },
    });
    await recordLedgerEntry(transaction, {
      entryType: "wallet_credit",
      amountCents,
      sourceType: "automation_funding",
      sourceId,
      idempotencyKey: `${sourceId}:wallet-credit`,
      userId: botUserId,
      simulated: false,
      metadata: { receiptReference },
    });
    await transaction.insert(automationEventsTable).values({
      eventType: "funding",
      botUserId,
      amountCents,
      receiptReference,
      summary: `Aporte confirmado de R$ ${(input.amountCents / 100).toFixed(2)} para a carteira pública do bot.`,
    });

    return {
      botWalletBalanceCents: safeNumber(newBalance),
      amountCents: input.amountCents,
      receiptReference,
    };
  });
}

export async function listAutomationEvents(input: {
  limit: number;
  offset: number;
}) {
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: automationEventsTable.id,
        eventType: automationEventsTable.eventType,
        disputeNumber: automationEventsTable.disputeNumber,
        amountCents: automationEventsTable.amountCents,
        summary: automationEventsTable.summary,
        createdAt: automationEventsTable.createdAt,
      })
      .from(automationEventsTable)
      .orderBy(desc(automationEventsTable.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ value: count() }).from(automationEventsTable),
  ]);

  return {
    items: items.map((event) => ({
      ...event,
      amountCents:
        event.amountCents === null ? null : safeNumber(event.amountCents),
      createdAt: event.createdAt.toISOString(),
    })),
    total: totalRows[0]?.value ?? 0,
  };
}

function recordBlockedEvent(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    botUserId: string;
    disputeId: string;
    disputeNumber: number;
    triggerBidId: string | null;
    reason: string;
  },
) {
  if (!input.triggerBidId) {
    return transaction
      .select({ id: automationEventsTable.id })
      .from(automationEventsTable)
      .where(
        and(
          eq(automationEventsTable.eventType, "blocked"),
          eq(automationEventsTable.disputeId, input.disputeId),
          isNull(automationEventsTable.triggerBidId),
        ),
      )
      .limit(1)
      .then(([existing]) => {
        if (existing) return;
        return transaction
          .insert(automationEventsTable)
          .values({
            eventType: "blocked",
            botUserId: input.botUserId,
            disputeId: input.disputeId,
            disputeNumber: input.disputeNumber,
            triggerBidId: null,
            summary: input.reason,
          })
          .onConflictDoNothing();
      });
  }

  return transaction
    .insert(automationEventsTable)
    .values({
      eventType: "blocked",
      botUserId: input.botUserId,
      disputeId: input.disputeId,
      disputeNumber: input.disputeNumber,
      triggerBidId: input.triggerBidId,
      summary: input.reason,
    })
    .onConflictDoNothing();
}

export async function runAutomationTick(): Promise<boolean> {
  const now = new Date();
  return db.transaction(async (transaction) => {
    const [config] = await transaction
      .select()
      .from(automationConfigTable)
      .where(eq(automationConfigTable.id, CONFIG_ID))
      .limit(1)
      .for("update");
    if (!config?.enabled || !config.botUserId) return false;

    const [dispute] = await transaction
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.status, "live"))
      .orderBy(desc(disputesTable.number))
      .limit(1)
      .for("update");
    if (!dispute) return false;

    let leader: typeof bidsTable.$inferSelect | null = null;
    if (dispute.leaderBidId) {
      const [currentLeader] = await transaction
        .select()
        .from(bidsTable)
        .where(eq(bidsTable.id, dispute.leaderBidId))
        .limit(1)
        .for("update");
      if (!currentLeader) {
        throw new Error(`Dispute ${dispute.id} is missing its leader bid.`);
      }
      leader = currentLeader;
    }

    const action = getAutomationBidAction(
      config.mode,
      leader !== null,
      leader?.userId === config.botUserId,
    );
    if (!action) return false;
    const isOpeningBid = action === "opening_bid";

    if (leader) {
      const [previousAttempt] = await transaction
        .select({ id: automationEventsTable.id })
        .from(automationEventsTable)
        .where(eq(automationEventsTable.triggerBidId, leader.id))
        .limit(1);
      if (previousAttempt) return false;
    }

    const actionStartedAt = leader?.createdAt ?? dispute.startedAt ?? dispute.startsAt;
    if (
      actionStartedAt.getTime() + config.minimumDelaySeconds * 1_000 >
      now.getTime()
    ) {
      return false;
    }

    const deadline = getDisputeDeadline(
      dispute.startedAt,
      dispute.startsAt,
      leader?.expiresAt ?? null,
    );
    const secondsRemaining = Math.max(
      0,
      Math.ceil((deadline.getTime() - now.getTime()) / 1_000),
    );
    const actionLabel = isOpeningBid ? "Lance de abertura" : "Contralance";
    const block = async (reason: string) => {
      await recordBlockedEvent(transaction, {
        botUserId: config.botUserId!,
        disputeId: dispute.id,
        disputeNumber: dispute.number,
        triggerBidId: leader?.id ?? null,
        reason: `${actionLabel} bloqueado: ${reason}`,
      });
      return false;
    };

    if (dispute.simulated) {
      return block("a disputa está marcada como simulada.");
    }
    if (secondsRemaining < config.minimumSecondsRemaining) {
      return block("resta menos tempo que o mínimo configurado.");
    }

    const bidCents = (leader?.valueCents ?? dispute.startingValueCents) + dispute.stepCents;
    if (bidCents > config.maxBidCents) {
      return block("o valor supera o limite por lance.");
    }

    const disputeEvents = await transaction
      .select({ amountCents: automationEventsTable.amountCents })
      .from(automationEventsTable)
      .where(
        and(
          eq(automationEventsTable.eventType, "bid"),
          eq(automationEventsTable.disputeId, dispute.id),
        ),
      );
    const disputeSpent = disputeEvents.reduce(
      (total, event) => total + (event.amountCents ?? 0n),
      0n,
    );
    if (
      disputeEvents.length >= config.maxBidsPerDispute ||
      disputeSpent + bidCents > config.perDisputeLimitCents
    ) {
      return block("o limite desta disputa foi atingido.");
    }

    const utcDayStart = new Date(now);
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const dailyEvents = await transaction
      .select({ amountCents: automationEventsTable.amountCents })
      .from(automationEventsTable)
      .where(
        and(
          eq(automationEventsTable.eventType, "bid"),
          gte(automationEventsTable.createdAt, utcDayStart),
        ),
      );
    const dailySpent = dailyEvents.reduce(
      (total, event) => total + (event.amountCents ?? 0n),
      0n,
    );
    if (dailySpent + bidCents > config.dailyLimitCents) {
      return block("o limite diário foi atingido.");
    }

    const [bot] = await transaction
      .select({
        publicName: usersTable.publicName,
        testAccount: usersTable.testAccount,
      })
      .from(usersTable)
      .where(eq(usersTable.id, config.botUserId))
      .limit(1);
    if (!bot || bot.testAccount || bot.publicName !== BOT_NAME) {
      return block("a identidade pública do bot não está válida.");
    }

    const [wallet] = await transaction
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, config.botUserId))
      .limit(1)
      .for("update");
    if (!wallet || wallet.balanceCents < bidCents) {
      return block("saldo confirmado insuficiente.");
    }

    const newBalance = wallet.balanceCents - bidCents;
    await transaction
      .update(walletsTable)
      .set({ balanceCents: newBalance, updatedAt: now })
      .where(eq(walletsTable.userId, config.botUserId));
    const [walletEntry] = await transaction
      .insert(walletEntriesTable)
      .values({
        userId: config.botUserId,
        type: "bid",
        amountCents: -bidCents,
        balanceAfterCents: newBalance,
        refType: "manual",
        refId: null,
      })
      .returning();
    const [bid] = await transaction
      .insert(bidsTable)
      .values({
        disputeId: dispute.id,
        userId: config.botUserId,
        valueCents: bidCents,
        costCents: bidCents,
        walletEntryId: walletEntry.id,
        expiresAt: getDisputeCountdownDeadline(now),
      })
      .returning();
    await transaction
      .update(walletEntriesTable)
      .set({ refType: "bid", refId: bid.id })
      .where(eq(walletEntriesTable.id, walletEntry.id));
    await transaction
      .update(disputesTable)
      .set({
        leaderBidId: bid.id,
        bidsCount: sql`${disputesTable.bidsCount} + 1`,
        bidsTotalCents: sql`${disputesTable.bidsTotalCents} + ${bidCents}`,
        updatedAt: now,
      })
      .where(eq(disputesTable.id, dispute.id));

    await recordBidAllocation(transaction, {
      bidId: bid.id,
      userId: config.botUserId,
      disputeId: dispute.id,
      amountCents: bid.costCents,
      platformShareBps: dispute.platformShareBps,
      coverageShareBps: dispute.coverageShareBps,
      simulated: false,
    });
    const coveredCents =
      ((dispute.bidsTotalCents + bidCents) *
        BigInt(dispute.coverageShareBps)) /
      10_000n;
    await updatePrizeCoverage(
      transaction,
      dispute.id,
      coveredCents,
      dispute.prizeCents,
      now,
    );
    await transaction.insert(automationEventsTable).values({
      eventType: "bid",
      botUserId: config.botUserId,
      disputeId: dispute.id,
      disputeNumber: dispute.number,
      triggerBidId: leader?.id ?? null,
      amountCents: bidCents,
      summary: isOpeningBid
        ? `${BOT_NAME} deu um lance de abertura identificado na disputa ${dispute.number}.`
        : `${BOT_NAME} deu um contralance identificado na disputa ${dispute.number}.`,
    });
    return true;
  });
}
