import { z } from "zod";
import {
  GetLanceStateResponse,
  PostLanceActionBody,
} from "./generated/api";

export * from "./generated/api";
export const ApiErrorBody = z.object({ error: z.string() });
export type LanceStateOutput = z.infer<typeof GetLanceStateResponse>;
export type LanceActionInput = z.infer<typeof PostLanceActionBody>;
export type {
  ApiError,
  Auction,
  AuctionPhase,
  AuthSession,
  Bid,
  BidRes,
  BidStatus,
  HealthStatus,
  HistoryEntry,
  LanceAction,
  LanceActionAction,
  LanceActionKeyType,
  LanceActionPaymentState,
  LanceActionResponse,
  LanceActionResponseResult,
  LanceState,
  LanceStateCfg,
  Payment,
  PaymentState,
  SignOut200,
  User,
  Wallet,
} from "./generated/types";
