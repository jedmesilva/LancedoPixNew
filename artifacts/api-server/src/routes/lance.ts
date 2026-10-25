import { Router, type IRouter } from "express";
import {
  ApiErrorBody,
  GetLanceStateResponse,
  PostLanceActionBody,
  PostLanceActionResponse,
} from "@workspace/api-zod";
import { applyLanceAction, getLanceState } from "../lib/lance";
import { getCurrentUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/lance/state", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const state = await getLanceState(user);
  res.json(GetLanceStateResponse.parse(state));
});

router.post("/lance/actions", async (req, res): Promise<void> => {
  const parsed = PostLanceActionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid Lance do Pix action",
    );
    res.status(400).json(ApiErrorBody.parse({ error: "Confira os dados enviados." }));
    return;
  }

  const user = await getCurrentUser(req);
  const response = await applyLanceAction(user, parsed.data);
  res.json(PostLanceActionResponse.parse(response));
});

export default router;
