import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq, ne, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ApiErrorBody,
  ChangePasswordBody,
  ChangePasswordResponse,
  CreateGoogleTestAccountResponse,
  GetAuthSessionResponse,
  SignInBody,
  SignInResponse,
  SignOutResponse,
  SignUpBody,
  SignUpResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { db, userSessionsTable, usersTable, walletsTable } from "@workspace/db";
import {
  createSession,
  getCurrentSession,
  getCurrentUser,
  publicUser,
  revokeCurrentSession,
} from "../lib/auth";

const router: IRouter = Router();
const scrypt = promisify(scryptCallback);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function hashPassword(password: string) {
  const salt = randomUUID().replaceAll("-", "");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest || !/^[a-f0-9]{128}$/.test(digest)) {
    return false;
  }
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

router.get("/auth/session", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  res.json(GetAuthSessionResponse.parse({ user: publicUser(user) }));
});

router.post("/auth/sign-up", async (req, res): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Confira os dados da conta." }));
    return;
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  if (!name || !emailPattern.test(email)) {
    res.status(400).json(ApiErrorBody.parse({ error: "Nome ou e-mail inválido." }));
    return;
  }

  try {
    const [user] = await db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(usersTable)
        .values({
          name,
          publicName: name,
          email,
          passwordHash: await hashPassword(parsed.data.password),
        })
        .returning();
      await transaction.insert(walletsTable).values({ userId: created.id });
      return [created];
    });

    await createSession(user.id, res);
    res.status(201).json(
      SignUpResponse.parse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          signedIn: true,
          testAccount: user.testAccount,
        },
      }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json(ApiErrorBody.parse({ error: "Já existe uma conta com esse e-mail." }));
      return;
    }
    throw error;
  }
});

router.post("/auth/sign-in", async (req, res): Promise<void> => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Confira o e-mail e a senha." }));
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .limit(1);

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json(ApiErrorBody.parse({ error: "E-mail ou senha incorretos." }));
    return;
  }

  await createSession(user.id, res);
  res.json(
    SignInResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        signedIn: true,
        testAccount: user.testAccount,
      },
    }),
  );
});

router.post("/auth/sign-out", async (req, res): Promise<void> => {
  await revokeCurrentSession(req, res);
  res.json(SignOutResponse.parse({ ok: true }));
});

router.post("/auth/google-test", async (_req, res): Promise<void> => {
  const suffix = randomUUID();
  const email = `google-test+${suffix}@example.invalid`;
  const [user] = await db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(usersTable)
      .values({
        name: "Conta de teste do Google",
        publicName: `Pessoa ${suffix.slice(0, 8)}`,
        email,
        passwordHash: null,
        testAccount: true,
      })
      .returning();
    await transaction.insert(walletsTable).values({ userId: created.id });
    return [created];
  });

  await createSession(user.id, res);
  res.status(201).json(
    CreateGoogleTestAccountResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        signedIn: true,
        testAccount: true,
      },
    }),
  );
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  const current = await getCurrentSession(req);
  if (!current) {
    res.status(401).json(ApiErrorBody.parse({ error: "Entre na sua conta para continuar." }));
    return;
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  const name = parsed.success ? parsed.data.name.trim() : "";
  if (!name || name.length < 2 || name.length > 80) {
    res.status(400).json(ApiErrorBody.parse({ error: "Informe um nome entre 2 e 80 caracteres." }));
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ name, publicName: name })
    .where(eq(usersTable.id, current.user.id))
    .returning();

  res.json(
    UpdateProfileResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        signedIn: true,
        testAccount: user.testAccount,
      },
    }),
  );
});

router.post("/auth/password", async (req, res): Promise<void> => {
  const current = await getCurrentSession(req);
  if (!current) {
    res.status(401).json(ApiErrorBody.parse({ error: "Entre na sua conta para continuar." }));
    return;
  }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(ApiErrorBody.parse({ error: "Confira a senha atual e a nova senha." }));
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, current.user.id))
    .limit(1);
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json(ApiErrorBody.parse({ error: "A senha atual está incorreta." }));
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.transaction(async (transaction) => {
    await transaction
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, user.id));
    await transaction
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        sql`${userSessionsTable.userId} = ${user.id}
          AND ${userSessionsTable.id} <> ${current.sessionId}
          AND ${userSessionsTable.revokedAt} IS NULL`,
      );
  });

  res.json(
    ChangePasswordResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        signedIn: true,
        testAccount: user.testAccount,
      },
    }),
  );
});

export default router;
