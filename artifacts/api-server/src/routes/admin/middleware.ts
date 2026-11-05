import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { ApiErrorBody } from "@workspace/api-zod";

export const ADMIN_SESSION_COOKIE = "lance_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

export function isAdminSessionValid(req: Request): boolean {
  const signedValue = req.signedCookies?.[ADMIN_SESSION_COOKIE];
  if (typeof signedValue !== "string") return false;
  const expiresAt = Number(signedValue);
  return Number.isSafeInteger(expiresAt) && expiresAt > Date.now();
}

export function requireAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAdminSessionValid(req)) {
    next();
    return;
  }
  res.status(401).json(ApiErrorBody.parse({ error: "Autenticação administrativa necessária." }));
}

export function verifyAdminKey(key: string): "valid" | "invalid" | "unconfigured" {
  const configuredKey =
    process.env.ADMIN_ACCESS_KEY?.trim() ||
    process.env.ADMIN_ACCESS_KEY_HASH?.trim();
  if (!configuredKey) return "unconfigured";

  const actual = Buffer.from(key, "utf8");
  const expected = Buffer.from(configuredKey, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? "valid"
    : "invalid";
}

export function setAdminSession(res: Response): void {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.cookie(ADMIN_SESSION_COOKIE, String(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    signed: true,
    path: "/api/admin",
    maxAge: SESSION_TTL_MS,
  });
}
