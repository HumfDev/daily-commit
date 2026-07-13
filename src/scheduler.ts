import type { GlobalConfig, RepoEntry } from "./config.js";
import { reposNeedingActions } from "./picker.js";
import { chance } from "./random.js";
import { actionsToday, type DcState } from "./state.js";

export interface TickDecision {
  shouldRun: boolean;
  reason: string;
  /** When true, process every under-served repo in this invocation. */
  catchUp: boolean;
}

/**
 * Decides whether THIS cron invocation does anything.
 * Catch-up for minActionsPerRepoPerDay always wins over runProbability
 * (so every selected repo can get its daily success). Quiet hours still block.
 */
export function decideTick(
  global: GlobalConfig,
  state: DcState,
  repos: RepoEntry[] = [],
): TickDecision {
  const hour = new Date().getUTCHours();
  if (global.quietHours.includes(hour)) {
    return {
      shouldRun: false,
      reason: `hour ${hour} UTC is within quietHours`,
      catchUp: false,
    };
  }

  const needing = reposNeedingActions(repos, global, state);
  if (needing.length > 0) {
    return {
      shouldRun: true,
      reason: `catch-up: ${needing.length} repo(s) below minActionsPerRepoPerDay (${global.minActionsPerRepoPerDay})`,
      catchUp: true,
    };
  }

  const today = actionsToday(state);
  if (today >= global.maxActionsPerDay) {
    return {
      shouldRun: false,
      reason: `maxActionsPerDay (${global.maxActionsPerDay}) already reached today`,
      catchUp: false,
    };
  }

  if (!chance(global.runProbability)) {
    return {
      shouldRun: false,
      reason: `random roll missed runProbability (${global.runProbability})`,
      catchUp: false,
    };
  }

  return { shouldRun: true, reason: "bonus tick (all repos already met daily minimum)", catchUp: false };
}
