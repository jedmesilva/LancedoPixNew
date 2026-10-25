import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  ApiErrorBody,
  GetLanceDemoStateResponse,
  PostLanceDemoActionBody,
  PostLanceDemoActionResponse,
} from "@workspace/api-zod";
import {
  applyLanceDemoAction,
  getLanceDemoState,
  isSimulationAction,
} from "../lib/lance-demo";

const router: IRouter = Router();
const SESSION_COOKIE = "lance_demo_session";

router.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const existing = req.signedCookies?.[SESSION_COOKIE];
  const sessionId =
    typeof existing === "string" ? existing : randomUUID();

  if (typeof existing !== "string") {
    res.cookie(SESSION_COOKIE, sessionId, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  res.locals.demoSessionId = sessionId;
  next();
});

function getSessionId(res: Response): string {
  const id: unknown = res.locals.demoSessionId;
  if (typeof id !== "string") {
    throw new Error("Lance do Pix demo session middleware was not initialized");
  }
  return id;
}

router.get("/lance-demo/state", async (_req, res): Promise<void> => {
  const state = await getLanceDemoState(getSessionId(res));
  res.json(GetLanceDemoStateResponse.parse(state));
});

router.post("/lance-demo/actions", async (req, res): Promise<void> => {
  const parsed = PostLanceDemoActionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid Lance do Pix demo action",
    );
    res.status(400).json(ApiErrorBody.parse({ error: parsed.error.message }));
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    isSimulationAction(parsed.data.action)
  ) {
    res.status(403).json(ApiErrorBody.parse({
      error: "Os controles de simulação só ficam disponíveis no ambiente de demonstração.",
    }));
    return;
  }

  const result = await applyLanceDemoAction(
    getSessionId(res),
    parsed.data,
  );
  res.json(PostLanceDemoActionResponse.parse(result));
});

export default router;
