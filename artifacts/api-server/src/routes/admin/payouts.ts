import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ApiErrorBody } from "@workspace/api-zod";
import { db, payoutRequestsTable, usersTable } from "@workspace/db";
import {
  ListAdminPayoutsQueryParams,
  ListAdminPayoutsResponse,
} from "./generated";
import { safeNumber } from "./queries";

const router: IRouter = Router();

router.get("/payouts", async (req, res): Promise<void> => {
  const parsed = ListAdminPayoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Os filtros de resgate são inválidos." }));
    return;
  }

  const where = parsed.data.status
    ? eq(payoutRequestsTable.status, parsed.data.status)
    : undefined;
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

export default router;
