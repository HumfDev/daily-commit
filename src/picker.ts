import type { ActionType, GlobalConfig, RepoEntry } from "./config.js";
import { pick, pickWeighted } from "./random.js";
import { hoursSinceLastRun, type DcState } from "./state.js";

export interface Selection {
  repo: RepoEntry;
  actionType: ActionType;
}

const ACTION_TYPES: Exclude<ActionType, "noop">[] = ["commit", "pull_request", "review", "issue"];

/**
 * Picks a repo uniformly, then a weighted-random action among that repo's
 * enabled actions that aren't in cooldown (plus "noop"). A repo whose
 * actions are all in cooldown simply lands on noop.
 */
export function pickRepoAndAction(
  repos: RepoEntry[],
  global: GlobalConfig,
  state: DcState,
): Selection {
  const repo = pick(repos);

  const weights: Record<ActionType, number> = {
    commit: 0,
    pull_request: 0,
    review: 0,
    issue: 0,
    noop: global.actionWeights.noop,
  };

  for (const actionType of ACTION_TYPES) {
    const enabled = repo.actions[actionType];
    const offCooldown = hoursSinceLastRun(state, repo.repo, actionType) >= global.cooldownHours;
    if (enabled && offCooldown) {
      weights[actionType] = global.actionWeights[actionType];
    }
  }

  const actionType = pickWeighted(weights);
  return { repo, actionType };
}
