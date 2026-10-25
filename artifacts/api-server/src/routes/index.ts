import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import lanceRouter from "./lance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(lanceRouter);

export default router;
