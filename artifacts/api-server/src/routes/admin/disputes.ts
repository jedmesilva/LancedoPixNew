import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ApiErrorBody } from "@workspace/api-zod";
import {
  automationConfigTable,
  bidsTable,
  db,
  disputeCashReservationsTable,
  disputesTable,
  usersTable,
} from "@workspace/db";
import {
  GetAdminDisputeParams,
  GetAdminDisputeResponse,
  ListAdminDisputesQueryParams,
  ListAdminDisputesResponse,
  CloseAdminDisputeParams,
  CloseAdminDisputeBody,
  CloseAdminDisputeResponse,
} from "./generated";
import {
  adminDisputeSummaryQuery,
  buildDisputeSearch,
  safeNumber,
  serializeDisputeSummary,
} from "./queries";
import {
  AdminDisputeActionError,
  closeDisputeAndRefundBids,
} from "../../lib/admin-disputes";
import { notifyLanceStateChanged } from "../../lib/realtime";

const router: IRouter = Router();

function auditInteger(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return safeNumber(BigInt(value));
  }
  throw new Error("Invalid integer stored in manual closure metadata.");
}

function auditText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Invalid text stored in manual closure metadata.");
  }
  return value;
}

router.get("/disputes", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = ListAdminDisputesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Os filtros de disputa são inválidos." }));
    return;
  }

  const filter = buildDisputeSearch(parsed.data.q);
  const where = filter
    ? and(eq(disputesTable.simulated, false), filter)
    : eq(disputesTable.simulated, false);
  const [items, totalRows] = await Promise.all([
    adminDisputeSummaryQuery()
      .where(where)
      .orderBy(desc(disputesTable.number))
      .limit(parsed.data.limit ?? 25)
      .offset(parsed.data.offset ?? 0),
    db
      .select({ value: count() })
      .from(disputesTable)
      .where(where),
  ]);

  res.json(
    ListAdminDisputesResponse.parse({
      items: items.map(serializeDisputeSummary),
      total: totalRows[0]?.value ?? 0,
    }),
  );
});

router.get("/disputes/:id", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = GetAdminDisputeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(404).json(ApiErrorBody.parse({ error: "Disputa não encontrada." }));
    return;
  }
  const id = parsed.data.id;
  const [dispute] = await adminDisputeSummaryQuery()
    .where(
      and(
        eq(disputesTable.id, id),
        eq(disputesTable.simulated, false),
      ),
    )
    .limit(1);
  if (!dispute) {
    res.status(404).json(ApiErrorBody.parse({ error: "Disputa não encontrada." }));
    return;
  }

  const [[config], bidRows, [prizeReservation]] = await Promise.all([
    db
      .select({ botUserId: automationConfigTable.botUserId })
      .from(automationConfigTable)
      .where(eq(automationConfigTable.id, 1))
      .limit(1),
    db
      .select({
        id: bidsTable.id,
        amountCents: bidsTable.valueCents,
        costCents: bidsTable.costCents,
        bidderId: bidsTable.userId,
        bidderName: usersTable.publicName,
        createdAt: bidsTable.createdAt,
        result: bidsTable.result,
      })
      .from(bidsTable)
      .innerJoin(usersTable, eq(usersTable.id, bidsTable.userId))
      .where(eq(bidsTable.disputeId, id))
      .orderBy(desc(bidsTable.createdAt), desc(bidsTable.valueCents)),
    db
      .select()
      .from(disputeCashReservationsTable)
      .where(
        and(
          eq(disputeCashReservationsTable.disputeId, id),
          eq(disputeCashReservationsTable.reservationType, "prize"),
        ),
      )
      .limit(1),
  ]);
  const closure = prizeReservation?.metadata.manualClosure;
  const closureRecord =
    closure && typeof closure === "object" && !Array.isArray(closure)
      ? (closure as Record<string, unknown>)
      : null;
  const afterState =
    closureRecord?.afterState &&
    typeof closureRecord.afterState === "object" &&
    !Array.isArray(closureRecord.afterState)
      ? (closureRecord.afterState as Record<string, unknown>)
      : null;
  const manualClosure =
    closureRecord?.action === "dispute.manual_close" && afterState
    ? {
        reason: auditText(closureRecord.reason),
        actorId: auditText(closureRecord.actorId),
        refundedBidCount: auditInteger(afterState?.refundedBidCount),
        refundedCreditsCents: auditInteger(
          afterState?.refundedCreditsCents,
        ),
        createdAt: auditText(closureRecord.createdAt),
      }
    : null;

  res.json(
    GetAdminDisputeResponse.parse({
      dispute: serializeDisputeSummary(dispute),
      bids: bidRows.map((bid) => ({
        id: bid.id,
        amountCents: safeNumber(bid.amountCents),
        costCents: safeNumber(bid.costCents),
        bidderName: bid.bidderName,
        automated: Boolean(config?.botUserId && bid.bidderId === config.botUserId),
        createdAt: bid.createdAt.toISOString(),
        result: bid.result,
      })),
      manualClosure,
    }),
  );
});

router.post("/disputes/:id/close", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsedParams = CloseAdminDisputeParams.safeParse(req.params);
  const parsedBody = CloseAdminDisputeBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(404).json(ApiErrorBody.parse({ error: "Disputa não encontrada." }));
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json(
      ApiErrorBody.parse({
        error: "Informe um motivo com pelo menos 3 caracteres.",
      }),
    );
    return;
  }

  try {
    const result = await closeDisputeAndRefundBids({
      disputeId: parsedParams.data.id,
      reason: parsedBody.data.reason.trim(),
      ipAddress: req.ip || null,
    });
    const response = CloseAdminDisputeResponse.parse({
      ...result,
      refundedCreditsCents: safeNumber(result.refundedCreditsCents),
    });
    notifyLanceStateChanged();
    res.json(response);
  } catch (error) {
    if (error instanceof AdminDisputeActionError) {
      res.status(error.status).json(ApiErrorBody.parse({ error: error.message }));
      return;
    }
    req.log.error({ err: error }, "Manual dispute closure failed.");
    res.status(500).json(
      ApiErrorBody.parse({
        error: "Não foi possível encerrar a disputa e devolver os créditos.",
      }),
    );
  }
});

export default router;
