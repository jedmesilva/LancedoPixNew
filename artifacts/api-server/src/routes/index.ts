import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lanceDemoRouter from "./lance-demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lanceDemoRouter);

export default router;
