import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  bidsTable,
  db,
  disputeCashReservationsTable,
  disputesTable,
  treasuryLedgerEntriesTable,
  usersTable,
  walletEntriesTable,
  walletsTable,
} from "@workspace/db";
import { releaseUnawardedPrizeReservation } from "./treasury";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AdminDisputeActionError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "AdminDisputeActionError";
  }
}

export type RefundPlanBid = {
  id: string;
  userId: string;
  costCents: bigint;
};

export function planBidRefunds(
  bids: readonly RefundPlanBid[],
  alreadyRefundedBidIds: ReadonlySet<string>,
) {
  const refundableBids = bids.filter(
    (bid) => !alreadyRefundedBidIds.has(bid.id),
  );
  const totalCents = refundableBids.reduce(
    (total, bid) => total + bid.costCents,
    0n,
  );
  const byUser = new Map<string, bigint>();
  for (const bid of refundableBids) {
    byUser.set(bid.userId, (byUser.get(bid.userId) ?? 0n) + bid.costCents);
  }
  return { refundableBids, totalCents, byUser };
}

export async function closeDisputeAndRefundBids(input: {
  disputeId: string;
  reason: string;
  ipAddress: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return db.transaction(async (transaction) => {
    const [dispute] = await transaction
      .select()
      .from(disputesTable)
      .where(
        and(
          eq(disputesTable.id, input.disputeId),
          eq(disputesTable.simulated, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!dispute) {
      throw new AdminDisputeActionError(
        "Disputa não encontrada.",
        404,
      );
    }
    if (dispute.status !== "live" && dispute.status !== "paused") {
      throw new AdminDisputeActionError(
        "Somente disputas em andamento ou pausadas podem ser encerradas manualmente.",
        409,
      );
    }

    const bids = await transaction
      .select({
        id: bidsTable.id,
        userId: bidsTable.userId,
        costCents: bidsTable.costCents,
        testAccount: usersTable.testAccount,
      })
      .from(bidsTable)
      .innerJoin(usersTable, eq(usersTable.id, bidsTable.userId))
      .where(eq(bidsTable.disputeId, dispute.id))
      .orderBy(asc(bidsTable.createdAt), asc(bidsTable.id))
      .for("update");

    const bidIds = bids.map((bid) => bid.id);
    const testAccountByUserId = new Map(
      bids.map((bid) => [bid.userId, bid.testAccount]),
    );
    const existingRefunds = bidIds.length
      ? await transaction
          .select({ bidId: walletEntriesTable.refId })
          .from(walletEntriesTable)
          .where(
            and(
              eq(walletEntriesTable.type, "refund"),
              eq(walletEntriesTable.refType, "manual"),
              inArray(walletEntriesTable.refId, bidIds),
            ),
          )
      : [];
    const alreadyRefundedBidIds = new Set(
      existingRefunds.flatMap((entry) => (entry.bidId ? [entry.bidId] : [])),
    );
    const plan = planBidRefunds(bids, alreadyRefundedBidIds);

    if (plan.refundableBids.some((bid) => bid.costCents <= 0n)) {
      throw new Error(`Dispute ${dispute.id} contains a bid with an invalid cost.`);
    }

    for (const userId of [...plan.byUser.keys()].sort()) {
      const [wallet] = await transaction
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .limit(1)
        .for("update");
      if (!wallet) {
        throw new Error(`Bidder ${userId} does not have a wallet.`);
      }

      let balanceAfterCents = wallet.balanceCents;
      const userBids = plan.refundableBids.filter(
        (bid) => bid.userId === userId,
      );
      for (const bid of userBids) {
        balanceAfterCents += bid.costCents;
        await transaction.insert(walletEntriesTable).values({
          userId,
          type: "refund",
          amountCents: bid.costCents,
          balanceAfterCents,
          refType: "manual",
          refId: bid.id,
        });

        const simulated =
          dispute.simulated || testAccountByUserId.get(bid.userId) === true;
        const platformShareCents =
          (bid.costCents * BigInt(dispute.platformShareBps)) / 10_000n;
        const coverageShareCents = bid.costCents - platformShareCents;
        await transaction.insert(treasuryLedgerEntriesTable).values({
          entryType: "wallet_credit",
          amountCents: bid.costCents,
          sourceType: "bid_refund",
          sourceId: bid.id,
          idempotencyKey: `admin-dispute-close:${dispute.id}:bid:${bid.id}:refund`,
          userId,
          disputeId: dispute.id,
          simulated,
          metadata: {
            action: "dispute.manual_close",
            bidId: bid.id,
            platformShareCents: platformShareCents.toString(),
            coverageShareCents: coverageShareCents.toString(),
          },
        });
      }

      await transaction
        .update(walletsTable)
        .set({ balanceCents: balanceAfterCents, updatedAt: now })
        .where(eq(walletsTable.userId, userId));
    }

    await transaction
      .update(bidsTable)
      .set({ result: "lost" })
      .where(eq(bidsTable.disputeId, dispute.id));

    await transaction
      .update(disputesTable)
      .set({
        status: "ended",
        endedAt: now,
        winnerId: null,
        leaderBidId: null,
        pausedAt: null,
        pausedRemainingS: null,
        updatedAt: now,
      })
      .where(eq(disputesTable.id, dispute.id));

    await releaseUnawardedPrizeReservation(transaction, dispute.id, now);

    const refundedBidCount = plan.refundableBids.length;
    const [reservation] = await transaction
      .update(disputeCashReservationsTable)
      .set({
        metadata: sql`${disputeCashReservationsTable.metadata} || ${JSON.stringify({
          manualClosure: {
            actorId: "shared_operator_key",
            action: "dispute.manual_close",
            reason: input.reason,
            ipAddress: input.ipAddress,
            beforeState: {
              status: dispute.status,
              winnerId: dispute.winnerId,
              leaderBidId: dispute.leaderBidId,
              bidsCount: dispute.bidsCount,
              bidsTotalCents: dispute.bidsTotalCents.toString(),
            },
            afterState: {
              status: "ended",
              winnerId: null,
              refundedBidCount,
              refundedCreditsCents: plan.totalCents.toString(),
            },
            createdAt: now.toISOString(),
          },
        })}::jsonb`,
        updatedAt: now,
      })
      .where(
        and(
          eq(disputeCashReservationsTable.disputeId, dispute.id),
          eq(disputeCashReservationsTable.reservationType, "prize"),
        ),
      )
      .returning({ id: disputeCashReservationsTable.id });
    if (!reservation) {
      throw new Error(`Dispute ${dispute.id} has no prize reservation to release.`);
    }

    return {
      disputeId: dispute.id,
      status: "ended" as const,
      refundedBidCount,
      refundedCreditsCents: plan.totalCents,
      endedAt: now,
    };
  });
}
