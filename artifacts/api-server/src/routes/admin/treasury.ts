import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ApiErrorBody } from "@workspace/api-zod";
import {
  db,
  treasuryLedgerEntriesTable,
  usersTable,
} from "@workspace/db";
import {
  GetAdminTreasuryResponse,
  ListAdminTreasuryMovementsQueryParams,
  ListAdminTreasuryMovementsResponse,
  RecordAdminTreasuryContributionBody,
  RecordAdminTreasuryContributionResponse,
} from "./generated";
import { getAdminTreasurySnapshot, safeNumber } from "./queries";
import { recordHouseContribution } from "../../lib/treasury";

const router: IRouter = Router();

router.get("/treasury", async (_req, res): Promise<void> => {
  const snapshot = await getAdminTreasurySnapshot();
  res.json(GetAdminTreasuryResponse.parse(snapshot));
});

const CASH_MOVEMENT_TYPES = [
  "cash_receipt",
  "house_contribution",
  "ad_revenue_receipt",
  "payout_paid",
  "refund_paid",
  "processing_fee",
] as const;

router.get("/treasury/movements", async (req, res): Promise<void> => {
  const parsed = ListAdminTreasuryMovementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(
      ApiErrorBody.parse({ error: "Os filtros de movimentação são inválidos." }),
    );
    return;
  }

  const where = and(
    eq(treasuryLedgerEntriesTable.simulated, false),
    inArray(treasuryLedgerEntriesTable.entryType, [...CASH_MOVEMENT_TYPES]),
  );
  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: treasuryLedgerEntriesTable.id,
        entryType: treasuryLedgerEntriesTable.entryType,
        sourceType: treasuryLedgerEntriesTable.sourceType,
        sourceId: treasuryLedgerEntriesTable.sourceId,
        amountCents: treasuryLedgerEntriesTable.amountCents,
        userName: usersTable.publicName,
        note: sql<string | null>`${treasuryLedgerEntriesTable.metadata}->>'note'`,
        reference: sql<string | null>`COALESCE(
          ${treasuryLedgerEntriesTable.metadata}->>'receiptReference',
          ${treasuryLedgerEntriesTable.metadata}->>'pixE2eId',
          ${treasuryLedgerEntriesTable.sourceId}
        )`,
        createdAt: treasuryLedgerEntriesTable.createdAt,
        runningBalanceCents: sql<string>`COALESCE(
          SUM(
            CASE
              WHEN ${treasuryLedgerEntriesTable.entryType} IN ('payout_paid', 'refund_paid', 'processing_fee')
                THEN -${treasuryLedgerEntriesTable.amountCents}
              ELSE ${treasuryLedgerEntriesTable.amountCents}
            END
          ) OVER (
            ORDER BY ${treasuryLedgerEntriesTable.createdAt} ASC,
                     ${treasuryLedgerEntriesTable.id} ASC
          ),
          0
        )::text`,
      })
      .from(treasuryLedgerEntriesTable)
      .leftJoin(usersTable, eq(usersTable.id, treasuryLedgerEntriesTable.userId))
      .where(where)
      .orderBy(
        desc(treasuryLedgerEntriesTable.createdAt),
        desc(treasuryLedgerEntriesTable.id),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(treasuryLedgerEntriesTable)
      .where(where),
  ]);

  res.json(
    ListAdminTreasuryMovementsResponse.parse({
      items: items.map((item) => {
        const category =
          item.entryType === "cash_receipt"
            ? "topup"
            : item.entryType === "house_contribution"
              ? "contribution"
              : item.entryType === "payout_paid"
                ? "payout"
                : item.entryType === "refund_paid"
                  ? "refund"
                  : item.entryType === "processing_fee"
                    ? "fee"
                    : "ad_revenue";
        const amountIsOutflow = ["payout_paid", "refund_paid", "processing_fee"].includes(
          item.entryType,
        );
        return {
          id: item.id.toString(),
          category,
          entryType: item.entryType,
          amountCents: amountIsOutflow
            ? -safeNumber(item.amountCents)
            : safeNumber(item.amountCents),
          userName: item.userName,
          note: item.note,
          reference: item.reference,
          createdAt: item.createdAt.toISOString(),
          runningBalanceCents: safeNumber(BigInt(item.runningBalanceCents)),
        };
      }),
      total: totalRows[0]?.value ?? 0,
    }),
  );
});

router.post("/treasury/contributions", async (req, res): Promise<void> => {
  const parsed = RecordAdminTreasuryContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      ApiErrorBody.parse({
        error: "Informe o valor, o comprovante e confirme que o aporte foi recebido.",
      }),
    );
    return;
  }

  const receiptReference = parsed.data.receiptReference.trim();
  const note = parsed.data.note?.trim() || undefined;
  const createdAt = new Date();
  try {
    await db.transaction(async (transaction) => {
      await recordHouseContribution(transaction, {
        id: receiptReference,
        amountCents: BigInt(parsed.data.amountCents),
        receivedAt: createdAt,
        note,
        simulated: false,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HOUSE_REFERENCE_USED") {
      res.status(409).json(
        ApiErrorBody.parse({ error: "Essa referência já foi registrada." }),
      );
      return;
    }
    res.status(400).json(
      ApiErrorBody.parse({
        error: "O aporte não foi registrado. Confirme que o dinheiro foi recebido.",
      }),
    );
    return;
  }

  res.status(201).json(
    RecordAdminTreasuryContributionResponse.parse({
      amountCents: parsed.data.amountCents,
      receiptReference,
      createdAt: createdAt.toISOString(),
    }),
  );
});

export default router;
