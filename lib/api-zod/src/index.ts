import { z } from "zod";
import {
  GetLanceStateResponse,
  PostLanceActionBody,
} from "./generated/api";

export * from "./generated/api";
export const ApiErrorBody = z.object({ error: z.string() });
export type LanceStateOutput = z.infer<typeof GetLanceStateResponse>;
export type LanceActionInput = z.infer<typeof PostLanceActionBody>;
