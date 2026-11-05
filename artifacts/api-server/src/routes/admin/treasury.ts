import { Router, type IRouter } from "express";
import { GetAdminTreasuryResponse } from "./generated";
import { getAdminTreasurySnapshot } from "./queries";

const router: IRouter = Router();

router.get("/treasury", async (_req, res): Promise<void> => {
  const snapshot = await getAdminTreasurySnapshot();
  res.json(GetAdminTreasuryResponse.parse(snapshot));
});

export default router;
