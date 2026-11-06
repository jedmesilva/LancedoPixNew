import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import lanceRouter from "./lance";
import adminRouter from "./admin";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyticsRouter);
router.use(authRouter);
router.use(lanceRouter);
router.use("/admin", adminRouter);

export default router;
