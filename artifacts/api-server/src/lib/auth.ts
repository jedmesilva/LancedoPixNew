import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, userSessionsTable, usersTable } from "@workspace/db";

export const SESSION_COOKIE = "lance_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  signedIn: true;
  testAccount: boolean;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest();
}

function getCookieToken(req: Request) {
  const token: unknown = req.signedCookies?.[SESSION_COOKIE];
  return typeof token === "string" && token.length >= 40 ? token : null;
}

export async function getCurrentSession(req: Request) {
  const token = getCookieToken(req);
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: userSessionsTable.id,
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      testAccount: usersTable.testAccount,
    })
    .from(userSessionsTable)
    .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(userSessionsTable.tokenHash, tokenHash(token)),
        gt(userSessionsTable.expiresAt, new Date()),
        isNull(userSessionsTable.revokedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    sessionId: row.sessionId,
    token,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      signedIn: true as const,
      testAccount: row.testAccount,
    },
  };
}

export async function getCurrentUser(req: Request): Promise<CurrentUser | null> {
  return (await getCurrentSession(req))?.user ?? null;
}

export async function createSession(userId: string, res: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(userSessionsTable).values({
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
  });
  res.cookie(SESSION_COOKIE, token, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: SESSION_DURATION_MS,
  });
}

export async function revokeCurrentSession(req: Request, res: Response) {
  const token = getCookieToken(req);
  if (token) {
    await db
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userSessionsTable.tokenHash, tokenHash(token)),
          isNull(userSessionsTable.revokedAt),
        ),
      );
  }
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
  });
}

export function publicUser(user: CurrentUser | null) {
  return user ?? {
    id: null,
    name: "",
    email: "",
    signedIn: false,
    testAccount: false,
  };
}
