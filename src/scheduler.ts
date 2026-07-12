import type { GlobalConfig } from "./config.js";
import { actionsToday, type DcState } from "./state.js";
import { chance } from "./random.js";

export interface TickDecision {
  shouldRun: boolean;
  reason: string;
}

/**
 * Decides whether THIS cron invocation does anything at all.
 * Cron may tick every 2 hours, but gating here — quiet hours,
 * a daily cap, and a random roll — is what makes the actual activity land
 * at unpredictable times instead of every single tick.
 */
export function decideTick(global: GlobalConfig, state: DcState): TickDecision {
  const hour = new Date().getUTCHours();
  if (global.quietHours.includes(hour)) {
    return { shouldRun: false, reason: `hour ${hour} UTC is within quietHours` };
  }

  const today = actionsToday(state);
  if (today >= global.maxActionsPerDay) {
    return {
      shouldRun: false,
      reason: `maxActionsPerDay (${global.maxActionsPerDay}) already reached today`,
    };
  }

  if (!chance(global.runProbability)) {
    return { shouldRun: false, reason: `random roll missed runProbability (${global.runProbability})` };
  }

  return { shouldRun: true, reason: "tick fired" };
}
