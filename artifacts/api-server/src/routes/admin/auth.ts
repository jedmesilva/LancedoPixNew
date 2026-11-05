import { Router, type IRouter } from "express";
import { ApiErrorBody } from "@workspace/api-zod";
import {
  CreateAdminSessionBody,
  CreateAdminSessionResponse,
  EndAdminSessionResponse,
  GetAdminSessionResponse,
} from "./generated";
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionValid,
  setAdminSession,
  verifyAdminKey,
} from "./middleware";

const router: IRouter = Router();

router.get("/auth/session", (req, res): void => {
  res.json(
    GetAdminSessionResponse.parse({
      authenticated: isAdminSessionValid(req),
    }),
  );
});

router.post("/auth/session", (req, res): void => {
  const parsed = CreateAdminSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      ApiErrorBody.parse({ error: "Informe uma chave administrativa válida." }),
    );
    return;
  }

  const result = verifyAdminKey(parsed.data.key);
  if (result === "unconfigured") {
    res.status(503).json(
      ApiErrorBody.parse({
        error: "A chave administrativa ainda não foi configurada no ambiente.",
      }),
    );
    return;
  }
  if (result === "invalid") {
    res.status(401).json(
      ApiErrorBody.parse({ error: "A chave administrativa está incorreta." }),
    );
    return;
  }

  setAdminSession(res);
  res.json(CreateAdminSessionResponse.parse({ authenticated: true }));
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
  });
  res.json(EndAdminSessionResponse.parse({ ok: true }));
});

export default router;
