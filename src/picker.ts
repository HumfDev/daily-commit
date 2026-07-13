import type { ActionType, GlobalConfig, RepoEntry } from "./config.js";
import { pick, pickWeighted, shuffle } from "./random.js";
import { actionsTodayForRepo, hoursSinceLastRun, type DcState } from "./state.js";

export interface Selection {
  repo: RepoEntry;
  actionType: ActionType;
}

const ACTION_TYPES: Exclude<ActionType, "noop">[] = ["commit", "pull_request", "review", "issue"];

/** Prefer reliable write actions when catching up so "successful" is likely. */
const CATCH_UP_ORDER: Exclude<ActionType, "noop">[] = [
  "commit",
  "pull_request",
  "review",
  "issue",
];

/**
 * Repos that still need successful actions today to meet minActionsPerRepoPerDay.
 * Order is shuffled so catch-up doesn't always hit the same list order.
 */
export function reposNeedingActions(
  repos: RepoEntry[],
  global: GlobalConfig,
  state: DcState,
): RepoEntry[] {
  const min = global.minActionsPerRepoPerDay;
  return shuffle(repos.filter((r) => actionsTodayForRepo(state, r.repo) < min));
}

function actionWeightsForRepo(
  repo: RepoEntry,
  global: GlobalConfig,
  state: DcState,
  opts: { allowNoop: boolean; ignoreCooldown: boolean },
): Record<ActionType, number> {
  const weights: Record<ActionType, number> = {
    commit: 0,
    pull_request: 0,
    review: 0,
    issue: 0,
    noop: opts.allowNoop ? global.actionWeights.noop : 0,
  };

  for (const actionType of ACTION_TYPES) {
    if (!repo.actions[actionType]) continue;
    const offCooldown =
      opts.ignoreCooldown ||
      hoursSinceLastRun(state, repo.repo, actionType) >= global.cooldownHours;
    if (offCooldown) {
      weights[actionType] = global.actionWeights[actionType];
    }
  }

  return weights;
}

/**
 * Picks one action for a specific repo. When catching up, noop is disabled and
 * cooldown is ignored so the daily minimum can still be met.
 */
export function pickActionForRepo(
  repo: RepoEntry,
  global: GlobalConfig,
  state: DcState,
  catchUp: boolean,
): ActionType {
  const weights = actionWeightsForRepo(repo, global, state, {
    allowNoop: !catchUp,
    ignoreCooldown: catchUp,
  });

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Fall back to any enabled action (usually commit) when catching up.
    if (catchUp) {
      for (const actionType of CATCH_UP_ORDER) {
        if (repo.actions[actionType]) return actionType;
      }
    }
    return "noop";
  }

  return pickWeighted(weights);
}

/**
 * Ordered list of actions to try for a repo until one succeeds (catch-up mode).
 * Starts with a weighted pick, then tries remaining enabled types.
 */
export function actionAttemptsForRepo(
  repo: RepoEntry,
  global: GlobalConfig,
  state: DcState,
  catchUp: boolean,
): Exclude<ActionType, "noop">[] {
  const first = pickActionForRepo(repo, global, state, catchUp);
  const enabled = CATCH_UP_ORDER.filter((t) => repo.actions[t]);
  if (first === "noop" || !enabled.includes(first)) {
    return enabled;
  }
  return [first, ...enabled.filter((t) => t !== first)];
}

/**
 * Legacy single-pick: prefer under-served repos, else uniform among all.
 */
export function pickRepoAndAction(
  repos: RepoEntry[],
  global: GlobalConfig,
  state: DcState,
): Selection {
  const needing = reposNeedingActions(repos, global, state);
  const pool = needing.length > 0 ? needing : repos;
  const repo = pick(pool);
  const catchUp = needing.length > 0;
  const actionType = pickActionForRepo(repo, global, state, catchUp);
  return { repo, actionType };
}
