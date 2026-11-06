import type { AutomationBidTriggerMode } from "@workspace/db";

export function shouldWaitForAutomationTrigger(input: {
  mode: AutomationBidTriggerMode;
  secondsRemaining: number;
  configuredSeconds: number;
  actionStartedAt: Date;
  minimumDelaySeconds: number;
  now: Date;
}): boolean {
  if (input.mode === "at_fixed_time") {
    return input.secondsRemaining > input.configuredSeconds;
  }

  return (
    input.actionStartedAt.getTime() + input.minimumDelaySeconds * 1_000 >
    input.now.getTime()
  );
}

export function isPastAutomationBidWindow(input: {
  mode: AutomationBidTriggerMode;
  secondsRemaining: number;
  minimumSecondsRemaining: number;
}): boolean {
  return (
    input.mode === "on_outbid" &&
    input.secondsRemaining < input.minimumSecondsRemaining
  );
}
