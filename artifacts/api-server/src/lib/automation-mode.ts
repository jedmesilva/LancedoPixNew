import type { AutomationMode } from "@workspace/db";

export type AutomationBidAction = "opening_bid" | "counterbid";

export function getAutomationBidAction(
  mode: AutomationMode,
  hasLeader: boolean,
  leaderIsBot: boolean,
): AutomationBidAction | null {
  if (!hasLeader) {
    return mode === "counterbids_only" ? null : "opening_bid";
  }

  if (leaderIsBot || mode === "bids_only") return null;
  return "counterbid";
}
