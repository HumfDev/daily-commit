import { describe, expect, it } from "vitest";
import type { ActionType, GlobalConfig, RepoEntry } from "./config.js";
import {
  actionAttemptsForRepo,
  pickActionForRepo,
  pickRepoAndAction,
  reposNeedingActions,
} from "./picker.js";
import type { DcState } from "./state.js";

function baseGlobal(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    runProbability: 1,
    quietHours: [],
    maxActionsPerDay: 500,
    minActionsPerRepoPerDay: 1,
    actionWeights: { commit: 3, pull_request: 2, review: 2, issue: 1, noop: 4 },
    safePaths: ["docs/**"],
    cooldownHours: 20,
    gitAuthor: "Test User",
    gitEmail: "test@users.noreply.github.com",
    ...overrides,
  };
}

function repo(
  name: string,
  actions: Partial<Record<Exclude<ActionType, "noop">, boolean>> = { commit: true },
): RepoEntry {
  return {
    repo: name,
    actions: {
      commit: false,
      pull_request: false,
      review: false,
      issue: false,
      ...actions,
    },
  };
}

describe("reposNeedingActions", () => {
  it("lists repos under the daily minimum", () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const state: DcState = {
      lastRun: {},
      dailyCount: {},
      dailyRepoCount: { [dateKey]: { "o/a": 1 } },
    };
    const needing = reposNeedingActions(
      [repo("o/a"), repo("o/b"), repo("o/c")],
      baseGlobal(),
      state,
    );
    expect(needing.map((r) => r.repo).sort()).toEqual(["o/b", "o/c"]);
  });
});

describe("pickActionForRepo", () => {
  it("never selects noop while catching up", () => {
    const r = repo("o/a", { commit: true });
    const global = baseGlobal({ actionWeights: { commit: 1, pull_request: 0, review: 0, issue: 0, noop: 100 } });
    const state: DcState = { lastRun: {}, dailyCount: {}, dailyRepoCount: {} };
    for (let i = 0; i < 50; i++) {
      expect(pickActionForRepo(r, global, state, true)).toBe("commit");
    }
  });

  it("ignores cooldown while catching up", () => {
    const r = repo("o/a", { commit: true });
    const global = baseGlobal({ cooldownHours: 24 });
    const state: DcState = {
      lastRun: { "o/a:commit": new Date().toISOString() },
      dailyCount: {},
      dailyRepoCount: {},
    };
    expect(pickActionForRepo(r, global, state, true)).toBe("commit");
  });
});

describe("actionAttemptsForRepo", () => {
  it("includes every enabled action type", () => {
    const r = repo("o/a", { commit: true, review: true });
    const attempts = actionAttemptsForRepo(
      r,
      baseGlobal(),
      { lastRun: {}, dailyCount: {}, dailyRepoCount: {} },
      true,
    );
    expect(attempts.sort()).toEqual(["commit", "review"]);
  });
});

describe("pickRepoAndAction", () => {
  it("never selects an action type that's disabled for the repo", () => {
    const r = repo("owner/name", { commit: true });
    const global = baseGlobal();
    const state: DcState = { lastRun: {}, dailyCount: {}, dailyRepoCount: {} };

    for (let i = 0; i < 200; i++) {
      const { actionType } = pickRepoAndAction([r], global, state);
      expect(["commit", "noop"]).toContain(actionType);
    }
  });

  it("prefers repos that still need today's minimum", () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const a = repo("o/done", { commit: true });
    const b = repo("o/need", { commit: true });
    const state: DcState = {
      lastRun: {},
      dailyCount: {},
      dailyRepoCount: { [dateKey]: { "o/done": 1 } },
    };
    for (let i = 0; i < 40; i++) {
      const { repo: picked } = pickRepoAndAction([a, b], baseGlobal(), state);
      expect(picked.repo).toBe("o/need");
    }
  });
});
