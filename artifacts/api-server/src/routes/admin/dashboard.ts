import { desc, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { disputesTable } from "@workspace/db";
import { getLanceActiveConnections } from "../../lib/realtime";
import { GetAdminDashboardResponse } from "./generated";
import {
  adminDisputeSummaryQuery,
  getAdminTreasurySnapshot,
  getPendingPayoutCount,
  serializeDisputeSummary,
} from "./queries";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [current] = await adminDisputeSummaryQuery()
    .where(inArray(disputesTable.status, ["scheduled", "live", "paused"]))
    .orderBy(desc(disputesTable.number))
    .limit(1);
  const recentRows = await adminDisputeSummaryQuery()
    .orderBy(desc(disputesTable.number))
    .limit(8);
  const [treasury, pendingPayoutCount] = await Promise.all([
    getAdminTreasurySnapshot(),
    getPendingPayoutCount(),
  ]);

  res.json(
    GetAdminDashboardResponse.parse({
      currentDispute: current ? serializeDisputeSummary(current) : null,
      activeConnections: getLanceActiveConnections(),
      pendingPayoutCount,
      treasury,
      recentDisputes: recentRows.map(serializeDisputeSummary),
    }),
  );
});

export default router;
