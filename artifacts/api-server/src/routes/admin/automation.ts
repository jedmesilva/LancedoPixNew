import { Router, type IRouter } from "express";
import {
  ApiError,
  GetAutomationConfigResponse,
  ListAutomationEventsQueryParams,
  ListAutomationEventsResponse,
  RecordAutomationFundingBody,
  RecordAutomationFundingResponse,
  UpdateAutomationConfigBody,
  UpdateAutomationConfigResponse,
} from "./generated";
import {
  getAutomationConfig,
  listAutomationEvents,
  recordAutomationFunding,
  updateAutomationConfig,
} from "../../lib/admin-automation";

const router: IRouter = Router();

router.get("/automation/config", async (_req, res): Promise<void> => {
  const config = await getAutomationConfig();
  res.json(GetAutomationConfigResponse.parse(config));
});

router.put("/automation/config", async (req, res): Promise<void> => {
  const parsed = UpdateAutomationConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      ApiError.parse({ error: "Confira os limites e regras enviados." }),
    );
    return;
  }

  try {
    const config = await updateAutomationConfig(parsed.data);
    res.json(UpdateAutomationConfigResponse.parse(config));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "BOT_NOT_FUNDED" ? 409 : 400;
    const message =
      code === "BOT_NOT_FUNDED"
        ? "Registre um aporte real confirmado antes de ligar a automação."
        : code === "LIMIT_ORDER_INVALID"
          ? "Os limites devem seguir a ordem: lance, disputa e dia."
          : code === "LIMITS_REQUIRED"
            ? "Informe limites positivos para ativar a automação."
            : "Não foi possível salvar as regras da automação.";
    res.status(status).json(ApiError.parse({ error: message }));
  }
});

router.post("/automation/funding", async (req, res): Promise<void> => {
  const parsed = RecordAutomationFundingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      ApiError.parse({
        error: "Informe o valor e a referência de um aporte já recebido.",
      }),
    );
    return;
  }

  try {
    const result = await recordAutomationFunding(parsed.data);
    res
      .status(201)
      .json(RecordAutomationFundingResponse.parse(result));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "RECEIPT_REFERENCE_USED" ? 409 : 400;
    const message =
      code === "RECEIPT_REFERENCE_USED"
        ? "Essa referência de aporte já foi registrada."
        : "O aporte não foi registrado. Confirme que o dinheiro foi recebido e tente novamente.";
    res.status(status).json(ApiError.parse({ error: message }));
  }
});

router.get("/automation/events", async (req, res): Promise<void> => {
  const parsed = ListAutomationEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(
      ApiError.parse({ error: "Os filtros do histórico da automação são inválidos." }),
    );
    return;
  }
  const result = await listAutomationEvents({
    limit: parsed.data.limit ?? 50,
    offset: parsed.data.offset ?? 0,
  });
  res.json(ListAutomationEventsResponse.parse(result));
});

export default router;
