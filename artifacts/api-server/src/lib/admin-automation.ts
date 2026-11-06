import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  sql,
} from "drizzle-orm";
import {
  type AutomationBidTriggerMode,
  type AutomationMode,
  type AutomationOperatorRules,
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
import {
  exceedsAutomationCap,
  hasInconsistentAutomationCaps,
  reachedAutomationCountCap,
} from "./automation-limits";
import { recordBidAllocation, recordLedgerEntry, updatePrizeCoverage } from "./treasury";

const CONFIG_ID = 1;
const BOT_NAME = "Bot oficial do Lance do Pix";
const BOT_EMAIL_DOMAIN = "example.invalid";
const DEFAULT_CONFIG = {
  enabled: false,
  mode: "counterbids_only" as const,
  bidTriggerMode: "on_outbid" as const,
  botUserId: null,
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
  bidTriggerMode: AutomationBidTriggerMode;
  botUserId: string | null;
  maxBidCents: number;
  perDisputeLimitCents: number;
  dailyLimitCents: number;
  maxBidsPerDispute: number;
  minimumSecondsRemaining: number;
  minimumDelaySeconds: number;
  operatorRules: AutomationOperatorRules;
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

function legacyOperatorRules(config: {
  enabled: boolean;
  mode: AutomationMode;
  bidTriggerMode: AutomationBidTriggerMode;
  maxBidCents: bigint;
  perDisputeLimitCents: bigint;
  dailyLimitCents: bigint;
  maxBidsPerDispute: number;
  minimumSecondsRemaining: number;
}): AutomationOperatorRules {
  const trigger =
    config.bidTriggerMode === "at_fixed_time" ? "final" : "immediate";
  return {
    status: config.enabled ? "ativa" : "desativada",
    opening: {
      on: config.mode !== "counterbids_only",
      trigger,
      seconds: config.minimumSecondsRemaining,
      multiplier: 1,
    },
    counter: {
      on: config.mode !== "bids_only",
      trigger,
      seconds: config.minimumSecondsRemaining,
      multiplier: 1,
    },
    limits: {
      bidsPerDispute: config.maxBidsPerDispute,
      bidsPerDay: 0,
      disputesPerDay: 0,
      maxBidCents: safeNumber(config.maxBidCents),
      perDisputeCents: safeNumber(config.perDisputeLimitCents),
      dailySpendCents: safeNumber(config.dailyLimitCents),
    },
  };
}

function modeForRules(rules: AutomationOperatorRules): AutomationMode {
  if (rules.opening.on && rules.counter.on) return "bids_and_counterbids";
  if (rules.opening.on) return "bids_only";
  return "counterbids_only";
}

function hasInvalidRuleLimits(rules: AutomationOperatorRules): boolean {
  return (
    rules.opening.seconds < 0 ||
    rules.opening.seconds > 60 ||
    rules.counter.seconds < 0 ||
    rules.counter.seconds > 60 ||
    rules.opening.multiplier < 1 ||
    rules.opening.multiplier > 1_000 ||
    rules.counter.multiplier < 1 ||
    rules.counter.multiplier > 1_000 ||
    rules.limits.bidsPerDispute < 0 ||
    rules.limits.bidsPerDay < 0 ||
    rules.limits.disputesPerDay < 0 ||
    hasInconsistentAutomationCaps({
      maxBidCents: rules.limits.maxBidCents,
      perDisputeLimitCents: rules.limits.perDisputeCents,
      dailyLimitCents: rules.limits.dailySpendCents,
    })
  );
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

export async function listAutomationAccounts() {
  const accounts = await db
    .select({
      id: usersTable.id,
      publicName: usersTable.publicName,
      testAccount: usersTable.testAccount,
      walletBalanceCents: walletsTable.balanceCents,
    })
    .from(usersTable)
    .innerJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
    .orderBy(asc(usersTable.publicName));

  return {
    items: accounts.map((account) => ({
      ...account,
      walletBalanceCents: safeNumber(account.walletBalanceCents),
    })),
  };
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
  const operatorRules =
    config?.operatorRules ?? legacyOperatorRules(values);
  const blockedReasons: string[] = [];
  if (!values.botUserId) blockedReasons.push("Selecione uma conta para a automação.");
  else if (!botExists) blockedReasons.push("A conta selecionada não está disponível para automação.");
  else if (botWalletBalanceCents <= 0n) {
    blockedReasons.push("A carteira da conta selecionada está sem saldo confirmado.");
  }
  if (hasInconsistentAutomationCaps(values)) {
    blockedReasons.push(
      "Os limites definidos devem seguir a ordem: lance, disputa e dia.",
    );
  }

  return {
    enabled: values.enabled,
    mode: values.mode,
    bidTriggerMode: values.bidTriggerMode,
    botUserId: values.botUserId,
    botExists,
    botName,
    botWalletBalanceCents: safeNumber(botWalletBalanceCents),
    maxBidCents: safeNumber(values.maxBidCents),
    perDisputeLimitCents: safeNumber(values.perDisputeLimitCents),
    dailyLimitCents: safeNumber(values.dailyLimitCents),
    maxBidsPerDispute: values.maxBidsPerDispute,
    minimumSecondsRemaining: values.minimumSecondsRemaining,
    minimumDelaySeconds: values.minimumDelaySeconds,
    operatorRules,
    canEnable: blockedReasons.length === 0,
    blockedReasons,
    updatedAt: config?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAutomationConfig(input: AutomationInput) {
  const rules = input.operatorRules;
  if (hasInvalidRuleLimits(rules)) {
    throw new Error("LIMIT_ORDER_INVALID");
  }
  const enabled = rules.status === "ativa";
  const mode = modeForRules(rules);
  const bidTriggerMode: AutomationBidTriggerMode =
    rules.counter.trigger === "final" ? "at_fixed_time" : "on_outbid";
  const maxBidCents = rules.limits.maxBidCents;
  const perDisputeLimitCents = rules.limits.perDisputeCents;
  const dailyLimitCents = rules.limits.dailySpendCents;
  const maxBidsPerDispute = rules.limits.bidsPerDispute;
  const minimumSecondsRemaining = Math.max(
    1,
    rules.counter.trigger === "final"
      ? rules.counter.seconds
      : rules.opening.seconds,
  );

  await db.transaction(async (transaction) => {
    const current = await ensureConfigRow(transaction);
    if (!current) throw new Error("AUTOMATION_CONFIG_UNAVAILABLE");

    let selectedAccountName = BOT_NAME;
    if (input.botUserId) {
      const [account] = await transaction
        .select({
          publicName: usersTable.publicName,
          testAccount: usersTable.testAccount,
          walletBalanceCents: walletsTable.balanceCents,
        })
        .from(usersTable)
        .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
        .where(eq(usersTable.id, input.botUserId))
        .limit(1);
      if (!account) throw new Error("AUTOMATION_ACCOUNT_NOT_FOUND");
      if (account.testAccount) throw new Error("AUTOMATION_TEST_ACCOUNT");
      if (account.walletBalanceCents === null) {
        throw new Error("AUTOMATION_WALLET_UNAVAILABLE");
      }
      selectedAccountName = account.publicName;
    }

    if (enabled) {
      if (!input.botUserId) throw new Error("BOT_NOT_FUNDED");
      const [wallet] = await transaction
        .select({ balanceCents: walletsTable.balanceCents })
        .from(walletsTable)
        .where(eq(walletsTable.userId, input.botUserId))
        .for("update");
      if (!wallet || wallet.balanceCents <= 0n) {
        throw new Error("BOT_NOT_FUNDED");
      }
    }

    await transaction
      .update(automationConfigTable)
      .set({
        enabled,
        mode,
        bidTriggerMode,
        botUserId: input.botUserId,
        maxBidCents: BigInt(maxBidCents),
        perDisputeLimitCents: BigInt(perDisputeLimitCents),
        dailyLimitCents: BigInt(dailyLimitCents),
        maxBidsPerDispute,
        minimumSecondsRemaining,
        minimumDelaySeconds: 1,
        operatorRules: rules,
        updatedAt: new Date(),
      })
      .where(eq(automationConfigTable.id, CONFIG_ID));

    const now = new Date();
    await transaction.insert(automationEventsTable).values({
      eventType: "config_updated",
      botUserId: input.botUserId,
      summary: `O modo, as regras e os limites da automação foram atualizados para ${selectedAccountName}.`,
      createdAt: now,
    });
    if (current.enabled !== enabled) {
      await transaction.insert(automationEventsTable).values({
        eventType: enabled ? "enabled" : "disabled",
        botUserId: input.botUserId,
        summary: enabled
          ? `A automação de lances foi ligada para ${selectedAccountName}.`
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
    const [fundedAccount] = await transaction
      .select({ publicName: usersTable.publicName })
      .from(usersTable)
      .where(eq(usersTable.id, botUserId))
      .limit(1);

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
      summary: `Aporte confirmado de R$ ${(input.amountCents / 100).toFixed(2)} para a carteira de ${fundedAccount?.publicName ?? BOT_NAME}.`,
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
    const rules = config.operatorRules ?? legacyOperatorRules(config);
    if (rules.status !== "ativa") return false;

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

    const action = !leader
      ? rules.opening.on
        ? "opening_bid"
        : null
      : leader.userId === config.botUserId
        ? null
        : rules.counter.on
          ? "counterbid"
          : null;
    if (!action) return false;
    const isOpeningBid = action === "opening_bid";
    const actionRule = isOpeningBid ? rules.opening : rules.counter;

    if (leader) {
      const [previousAttempt] = await transaction
        .select({ id: automationEventsTable.id })
        .from(automationEventsTable)
        .where(eq(automationEventsTable.triggerBidId, leader.id))
        .limit(1);
      if (previousAttempt) return false;
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
    if (
      actionRule.trigger === "final" &&
      secondsRemaining > actionRule.seconds
    ) {
      return false;
    }

    const disputeEvents = await transaction
      .select({
        amountCents: automationEventsTable.amountCents,
        disputeId: automationEventsTable.disputeId,
      })
      .from(automationEventsTable)
      .where(
        and(
          eq(automationEventsTable.eventType, "bid"),
          eq(automationEventsTable.disputeId, dispute.id),
          eq(automationEventsTable.botUserId, config.botUserId),
        ),
      );
    const disputeSpent = disputeEvents.reduce(
      (total, event) => total + (event.amountCents ?? 0n),
      0n,
    );
    if (
      reachedAutomationCountCap(
        rules.limits.bidsPerDispute,
        disputeEvents.length,
      )
    ) {
      return block("o limite desta disputa foi atingido.");
    }

    const localDateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const localDatePart = (type: string) =>
      localDateParts.find((part) => part.type === type)?.value;
    const saoPauloMidnightUtc = new Date(
      `${localDatePart("year")}-${localDatePart("month")}-${localDatePart("day")}T03:00:00.000Z`,
    );
    const dailyEvents = await transaction
      .select({
        amountCents: automationEventsTable.amountCents,
        disputeId: automationEventsTable.disputeId,
      })
      .from(automationEventsTable)
      .where(
        and(
          eq(automationEventsTable.eventType, "bid"),
          eq(automationEventsTable.botUserId, config.botUserId),
          gte(automationEventsTable.createdAt, saoPauloMidnightUtc),
        ),
      );
    const dailySpent = dailyEvents.reduce(
      (total, event) => total + (event.amountCents ?? 0n),
      0n,
    );
    const uniqueDisputesToday = new Set(
      dailyEvents.flatMap((event) => (event.disputeId ? [event.disputeId] : [])),
    );
    if (
      reachedAutomationCountCap(
        rules.limits.bidsPerDay,
        dailyEvents.length,
      ) ||
      (rules.limits.disputesPerDay > 0 &&
        !uniqueDisputesToday.has(dispute.id) &&
        uniqueDisputesToday.size >= rules.limits.disputesPerDay)
    ) {
      return block("o limite diário de lances ou disputas foi atingido.");
    }

    const [bot] = await transaction
      .select({
        publicName: usersTable.publicName,
        testAccount: usersTable.testAccount,
      })
      .from(usersTable)
      .where(eq(usersTable.id, config.botUserId))
      .limit(1);
    if (!bot || bot.testAccount) {
      return block("a conta selecionada não está disponível para automação.");
    }

    const [wallet] = await transaction
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, config.botUserId))
      .limit(1)
      .for("update");
    if (!wallet) {
      return block("saldo confirmado insuficiente.");
    }

    const minimumBidCents =
      (leader?.valueCents ?? dispute.startingValueCents) + dispute.stepCents;
    let bidCents =
      (leader?.valueCents ?? dispute.startingValueCents) +
      dispute.stepCents * BigInt(actionRule.multiplier);
    const getBidLimitReason = (amount: bigint): string | null => {
      if (exceedsAutomationCap(BigInt(rules.limits.maxBidCents), amount)) {
        return "o valor supera o limite por lance.";
      }
      if (
        exceedsAutomationCap(
          BigInt(rules.limits.perDisputeCents),
          disputeSpent + amount,
        )
      ) {
        return "o limite total desta disputa foi atingido.";
      }
      if (
        exceedsAutomationCap(
          BigInt(rules.limits.dailySpendCents),
          dailySpent + amount,
        )
      ) {
        return "o limite diário de gasto foi atingido.";
      }
      if (wallet.balanceCents < amount) {
        return "saldo confirmado insuficiente.";
      }
      return null;
    };
    let limitReason = getBidLimitReason(bidCents);
    if (limitReason && bidCents !== minimumBidCents) {
      const minimumBidReason = getBidLimitReason(minimumBidCents);
      if (!minimumBidReason) {
        bidCents = minimumBidCents;
        limitReason = null;
      } else {
        limitReason = minimumBidReason;
      }
    }
    if (limitReason) return block(limitReason);

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
        ? `${bot.publicName} deu um lance de abertura automatizado na disputa ${dispute.number}.`
        : `${bot.publicName} deu um contralance automatizado na disputa ${dispute.number}.`,
    });
    return true;
  });
}
