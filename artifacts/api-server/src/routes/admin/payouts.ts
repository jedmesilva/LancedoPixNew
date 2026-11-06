import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ApiErrorBody } from "@workspace/api-zod";
import {
  bidsTable,
  db,
  disputeCashReservationsTable,
  disputesTable,
  payoutEventsTable,
  payoutRequestsTable,
  treasuryLedgerEntriesTable,
  usersTable,
} from "@workspace/db";
import {
  UpdateAdminPayoutBody,
  UpdateAdminPayoutParams,
  UpdateAdminPayoutResponse,
  ListAdminPayoutsQueryParams,
  ListAdminPayoutsResponse,
} from "./generated";
import { safeNumber } from "./queries";
import { recordLedgerEntry } from "../../lib/treasury";

const router: IRouter = Router();
type PayoutStatus = "requested" | "under_review" | "paid" | "rejected";

function isAllowedPayoutTransition(
  current: PayoutStatus,
  next: PayoutStatus,
): boolean {
  return (
    (current === "requested" && next === "under_review") ||
    (current === "under_review" && (next === "paid" || next === "rejected")) ||
    (current === "rejected" && next === "requested")
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

router.get("/payouts", async (req, res): Promise<void> => {
  const parsed = ListAdminPayoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Os filtros de resgate são inválidos." }));
    return;
  }

  const filters = [eq(usersTable.testAccount, false)];
  if (parsed.data.status) {
    filters.push(eq(payoutRequestsTable.status, parsed.data.status));
  }
  const search = parsed.data.q?.trim();
  if (search) {
    const pattern = `%${search}%`;
    const searchFilter = or(
      ilike(usersTable.publicName, pattern),
      ilike(usersTable.email, pattern),
      sql`${payoutRequestsTable.id}::text ILIKE ${pattern}`,
    );
    if (searchFilter) filters.push(searchFilter);
  }
  const where = and(...filters);
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: payoutRequestsTable.id,
        status: payoutRequestsTable.status,
        amountCents: payoutRequestsTable.amountCents,
        prizeCents: payoutRequestsTable.prizeCents,
        bonusCents: payoutRequestsTable.bonusCents,
        userName: usersTable.publicName,
        pixKeyType: payoutRequestsTable.keyType,
        requestedAt: payoutRequestsTable.requestedAt,
        updatedAt: payoutRequestsTable.updatedAt,
      })
      .from(payoutRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, payoutRequestsTable.userId))
      .where(where)
      .orderBy(desc(payoutRequestsTable.requestedAt))
      .limit(parsed.data.limit ?? 25)
      .offset(parsed.data.offset ?? 0),
    db
      .select({ value: count() })
      .from(payoutRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, payoutRequestsTable.userId))
      .where(where),
  ]);

  res.json(
    ListAdminPayoutsResponse.parse({
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        amountCents: safeNumber(item.amountCents),
        prizeCents: safeNumber(item.prizeCents),
        bonusCents: safeNumber(item.bonusCents),
        userName: item.userName,
        pixKeyType: item.pixKeyType,
        requestedAt: item.requestedAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total: totalRows[0]?.value ?? 0,
    }),
  );
});

router.patch("/payouts/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminPayoutParams.safeParse(req.params);
  const body = UpdateAdminPayoutBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json(
      ApiErrorBody.parse({ error: "Confira os dados da atualização do resgate." }),
    );
    return;
  }

  const nextStatus = body.data.status as PayoutStatus;
  if (nextStatus === "paid" && !body.data.pixE2eId?.trim()) {
    res.status(400).json(
      ApiErrorBody.parse({
        error: "Informe o identificador Pix da transferência confirmada.",
      }),
    );
    return;
  }
  if (nextStatus === "rejected" && !body.data.reason?.trim()) {
    res.status(400).json(
      ApiErrorBody.parse({
        error: "Informe o motivo antes de recusar o resgate.",
      }),
    );
    return;
  }

  try {
    const updated = await db.transaction(async (transaction) => {
      const [payout] = await transaction
        .select()
        .from(payoutRequestsTable)
        .where(eq(payoutRequestsTable.id, params.data.id))
        .limit(1)
        .for("update");
      if (!payout) throw new Error("PAYOUT_NOT_FOUND");
      if (!isAllowedPayoutTransition(payout.status as PayoutStatus, nextStatus)) {
        throw new Error("PAYOUT_TRANSITION_INVALID");
      }

      const now = new Date();
      await transaction
        .update(payoutRequestsTable)
        .set({
          status: nextStatus,
          updatedAt: now,
          rejectionReason:
            nextStatus === "rejected"
              ? body.data.reason!.trim()
              : null,
          pixE2eId:
            nextStatus === "paid" ? body.data.pixE2eId!.trim() : null,
          paidAt: nextStatus === "paid" ? now : null,
        })
        .where(eq(payoutRequestsTable.id, payout.id));

      const eventNote =
        nextStatus === "under_review"
          ? "O resgate foi encaminhado para processamento manual."
          : nextStatus === "paid"
            ? `Pagamento Pix confirmado. Referência: ${body.data.pixE2eId!.trim()}`
            : nextStatus === "rejected"
              ? `Resgate recusado: ${body.data.reason!.trim()}`
              : "Resgate reenfileirado para processamento.";
      await transaction.insert(payoutEventsTable).values({
        payoutId: payout.id,
        status: nextStatus,
        note: eventNote,
        visibleToUser: true,
        author: "admin",
        createdAt: now,
      });

      const [bid] = await transaction
        .select({
          disputeId: bidsTable.disputeId,
        })
        .from(bidsTable)
        .where(eq(bidsTable.id, payout.bidId))
        .limit(1);
      if (!bid) throw new Error("PAYOUT_DISPUTE_NOT_FOUND");

      if (nextStatus === "paid") {
        await recordLedgerEntry(transaction, {
          entryType: "payout_paid",
          amountCents: payout.amountCents,
          sourceType: "payout",
          sourceId: payout.id,
          idempotencyKey: `payout:${payout.id}:paid`,
          userId: payout.userId,
          simulated: false,
          metadata: {
            pixE2eId: body.data.pixE2eId!.trim(),
            operator: "admin",
          },
          createdAt: now,
        });
        await transaction
          .update(disputeCashReservationsTable)
          .set({ status: "paid", updatedAt: now })
          .where(
            and(
              eq(disputeCashReservationsTable.disputeId, bid.disputeId),
              eq(disputeCashReservationsTable.reservationType, "prize"),
            ),
          );
      } else if (nextStatus === "rejected") {
        const [dispute] = await transaction
          .select({
            bidsTotalCents: disputesTable.bidsTotalCents,
            coverageShareBps: disputesTable.coverageShareBps,
            prizeCents: disputesTable.prizeCents,
          })
          .from(disputesTable)
          .where(eq(disputesTable.id, bid.disputeId))
          .limit(1);
        if (!dispute) throw new Error("PAYOUT_DISPUTE_NOT_FOUND");
        const coveredCents =
          (dispute.bidsTotalCents * BigInt(dispute.coverageShareBps)) /
          10_000n;
        await transaction
          .update(disputeCashReservationsTable)
          .set({
            status: coveredCents >= dispute.prizeCents ? "funded" : "obligated",
            updatedAt: now,
          })
          .where(
            and(
              eq(disputeCashReservationsTable.disputeId, bid.disputeId),
              eq(disputeCashReservationsTable.reservationType, "prize"),
            ),
          );
      } else {
        await transaction
          .update(disputeCashReservationsTable)
          .set({ status: "payout_requested", updatedAt: now })
          .where(
            and(
              eq(disputeCashReservationsTable.disputeId, bid.disputeId),
              eq(disputeCashReservationsTable.reservationType, "prize"),
            ),
          );
      }

      return {
        id: payout.id,
        status: nextStatus,
        updatedAt: now.toISOString(),
      };
    });

    res.json(UpdateAdminPayoutResponse.parse(updated));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status =
      code === "PAYOUT_NOT_FOUND" || code === "PAYOUT_DISPUTE_NOT_FOUND"
        ? 404
        : code === "PAYOUT_TRANSITION_INVALID" || isUniqueViolation(error)
          ? 409
          : 500;
    const message =
      code === "PAYOUT_NOT_FOUND" || code === "PAYOUT_DISPUTE_NOT_FOUND"
        ? "Resgate não encontrado."
        : code === "PAYOUT_TRANSITION_INVALID"
          ? "Este resgate não pode ser movido para o estado solicitado."
          : isUniqueViolation(error)
            ? "A referência Pix já está associada a outro pagamento ou o resgate não pode ser reenfileirado."
            : "Não foi possível atualizar o resgate.";
    res.status(status).json(ApiErrorBody.parse({ error: message }));
  }
});

export default router;
