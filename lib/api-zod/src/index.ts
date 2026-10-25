import { z } from "zod";
import {
  GetLanceDemoStateResponse,
  PostLanceDemoActionBody,
} from "./generated/api";

export * from "./generated/api";
export * from "./generated/types";
export const ApiErrorBody = z.object({ error: z.string() });
export type LanceDemoStateOutput = z.infer<typeof GetLanceDemoStateResponse>;
export type LanceDemoActionInput = z.infer<typeof PostLanceDemoActionBody>;
