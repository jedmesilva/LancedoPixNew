import { Router, type IRouter } from "express";
import authRouter from "./auth";
import automationRouter from "./automation";
import dashboardRouter from "./dashboard";
import disputesRouter from "./disputes";
import { requireAdminSession } from "./middleware";
import payoutsRouter from "./payouts";
import treasuryRouter from "./treasury";

const router: IRouter = Router();

router.use(authRouter);
router.use(requireAdminSession);
router.use(dashboardRouter);
router.use(disputesRouter);
router.use(payoutsRouter);
router.use(treasuryRouter);
router.use(automationRouter);

export default router;
