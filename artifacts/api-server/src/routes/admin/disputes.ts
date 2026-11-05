import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  automationConfigTable,
  bidsTable,
  db,
  disputesTable,
  usersTable,
} from "@workspace/db";
import {
  ApiError,
  GetAdminDisputeParams,
  GetAdminDisputeResponse,
  ListAdminDisputesQueryParams,
  ListAdminDisputesResponse,
} from "./generated";
import {
  adminDisputeSummaryQuery,
  buildDisputeSearch,
  safeNumber,
  serializeDisputeSummary,
} from "./queries";

const router: IRouter = Router();

router.get("/disputes", async (req, res): Promise<void> => {
  const parsed = ListAdminDisputesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(ApiError.parse({ error: "Os filtros de disputa são inválidos." }));
    return;
  }

  const filter = buildDisputeSearch(parsed.data.q);
  const where = filter ? and(filter) : undefined;
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
  const parsed = GetAdminDisputeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(404).json(ApiError.parse({ error: "Disputa não encontrada." }));
    return;
  }
  const id = parsed.data.id;
  const [dispute] = await adminDisputeSummaryQuery()
    .where(eq(disputesTable.id, id))
    .limit(1);
  if (!dispute) {
    res.status(404).json(ApiError.parse({ error: "Disputa não encontrada." }));
    return;
  }

  const [config] = await db
    .select({ botUserId: automationConfigTable.botUserId })
    .from(automationConfigTable)
    .where(eq(automationConfigTable.id, 1))
    .limit(1);
  const bidRows = await db
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
    .orderBy(desc(bidsTable.createdAt), desc(bidsTable.valueCents));

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
    }),
  );
});

export default router;
