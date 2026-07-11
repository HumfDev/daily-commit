import { describe, expect, it } from "vitest";
import type { ActionType, GlobalConfig, RepoEntry } from "./config.js";
import { pickRepoAndAction } from "./picker.js";
import type { DcState } from "./state.js";

function baseGlobal(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    runProbability: 1,
    quietHours: [],
    maxActionsPerDay: 5,
    actionWeights: { commit: 3, pull_request: 2, review: 2, issue: 1, noop: 4 },
    safePaths: ["docs/**"],
    cooldownHours: 20,
    gitAuthor: "Test User",
    gitEmail: "test@users.noreply.github.com",
    ...overrides,
  };
}

function repo(actions: Partial<Record<Exclude<ActionType, "noop">, boolean>>): RepoEntry {
  return {
    repo: "owner/name",
    actions: {
      commit: false,
      pull_request: false,
      review: false,
      issue: false,
      ...actions,
    },
  };
}

describe("pickRepoAndAction", () => {
  it("never selects an action type that's disabled for the repo", () => {
    const r = repo({ commit: true });
    const global = baseGlobal();
    const state: DcState = { lastRun: {}, dailyCount: {} };

    for (let i = 0; i < 200; i++) {
      const { actionType } = pickRepoAndAction([r], global, state);
      expect(["commit", "noop"]).toContain(actionType);
    }
  });

  it("falls back to noop when every enabled action is in cooldown", () => {
    const r = repo({ commit: true, review: true });
    const global = baseGlobal({ cooldownHours: 24 });
    const now = new Date();
    const state: DcState = {
      lastRun: {
        "owner/name:commit": now.toISOString(),
        "owner/name:review": now.toISOString(),
      },
      dailyCount: {},
    };

    for (let i = 0; i < 50; i++) {
      const { actionType } = pickRepoAndAction([r], global, state);
      expect(actionType).toBe("noop");
    }
  });

  it("only ever selects the single repo passed in", () => {
    const r = repo({ issue: true });
    const global = baseGlobal();
    const state: DcState = { lastRun: {}, dailyCount: {} };
    const { repo: picked } = pickRepoAndAction([r], global, state);
    expect(picked.repo).toBe("owner/name");
  });
});
