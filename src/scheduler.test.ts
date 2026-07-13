import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalConfig } from "./config.js";
import { decideTick } from "./scheduler.js";
import type { DcState } from "./state.js";

function baseConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    runProbability: 1,
    quietHours: [],
    maxActionsPerDay: 5,
    minActionsPerRepoPerDay: 1,
    actionWeights: { commit: 3, pull_request: 2, review: 2, issue: 1, noop: 4 },
    safePaths: ["docs/**"],
    cooldownHours: 20,
    gitAuthor: "Test User",
    gitEmail: "test@users.noreply.github.com",
    ...overrides,
  };
}

function emptyState(): DcState {
  return { lastRun: {}, dailyCount: {}, dailyRepoCount: {} };
}

const sampleRepos = [
  {
    repo: "a/one",
    actions: { commit: true, pull_request: true, review: true, issue: true },
  },
  {
    repo: "a/two",
    actions: { commit: true, pull_request: true, review: true, issue: true },
  },
];

describe("decideTick", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("declines to run during a configured quiet hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T02:00:00Z"));
    const decision = decideTick(baseConfig({ quietHours: [2] }), emptyState(), sampleRepos);
    expect(decision.shouldRun).toBe(false);
    expect(decision.reason).toContain("quietHours");
  });

  it("forces catch-up when any repo is below the daily minimum", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const decision = decideTick(
      baseConfig({ runProbability: 0.01, maxActionsPerDay: 0 }),
      emptyState(),
      sampleRepos,
    );
    expect(decision.shouldRun).toBe(true);
    expect(decision.catchUp).toBe(true);
    expect(decision.reason).toContain("catch-up");
  });

  it("declines bonus ticks once maxActionsPerDay is reached and mins are met", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-10T12:00:00Z");
    vi.setSystemTime(now);
    const dateKey = now.toISOString().slice(0, 10);
    const state: DcState = {
      lastRun: {},
      dailyCount: { [dateKey]: 5 },
      dailyRepoCount: {
        [dateKey]: { "a/one": 1, "a/two": 1 },
      },
    };
    const decision = decideTick(baseConfig({ maxActionsPerDay: 5 }), state, sampleRepos);
    expect(decision.shouldRun).toBe(false);
    expect(decision.reason).toContain("maxActionsPerDay");
  });

  it("runs a bonus tick when mins are met and the roll hits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.0);
    const dateKey = "2026-07-10";
    const state: DcState = {
      lastRun: {},
      dailyCount: { [dateKey]: 2 },
      dailyRepoCount: { [dateKey]: { "a/one": 1, "a/two": 1 } },
    };
    const decision = decideTick(baseConfig({ runProbability: 1 }), state, sampleRepos);
    expect(decision.shouldRun).toBe(true);
    expect(decision.catchUp).toBe(false);
  });
});
