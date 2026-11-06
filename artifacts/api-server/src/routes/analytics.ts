import { createHmac, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, siteVisitorDailyTable } from "@workspace/db";

const router: IRouter = Router();
const VISITOR_COOKIE = "lance_visitor";
const VISITOR_COOKIE_TTL_MS = 365 * 24 * 60 * 60 * 1_000;

function saoPauloDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

router.post("/analytics/visit", async (req, res): Promise<void> => {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    res.status(503).json({ error: "A medição de visitas está indisponível." });
    return;
  }

  const signedVisitorId = req.signedCookies?.[VISITOR_COOKIE];
  const visitorId =
    typeof signedVisitorId === "string" &&
    /^[0-9a-f-]{36}$/i.test(signedVisitorId)
      ? signedVisitorId
      : randomUUID();

  if (visitorId !== signedVisitorId) {
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      signed: true,
      path: "/api/analytics",
      maxAge: VISITOR_COOKIE_TTL_MS,
    });
  }

  const visitorHash = createHmac("sha256", sessionSecret)
    .update(visitorId)
    .digest("hex");
  await db
    .insert(siteVisitorDailyTable)
    .values({ visitorHash, visitDate: saoPauloDate() })
    .onConflictDoNothing();

  res.sendStatus(204);
});

export default router;
