import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalConfig } from "./config.js";
import { decideTick } from "./scheduler.js";
import type { DcState } from "./state.js";

function baseConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
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

function emptyState(): DcState {
  return { lastRun: {}, dailyCount: {} };
}

describe("decideTick", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("declines to run during a configured quiet hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T02:00:00Z")); // hour 2 UTC
    const decision = decideTick(baseConfig({ quietHours: [2] }), emptyState());
    expect(decision.shouldRun).toBe(false);
    expect(decision.reason).toContain("quietHours");
  });

  it("declines to run once maxActionsPerDay is already reached", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-10T12:00:00Z");
    vi.setSystemTime(now);
    const dateKey = now.toISOString().slice(0, 10);
    const state: DcState = { lastRun: {}, dailyCount: { [dateKey]: 5 } };
    const decision = decideTick(baseConfig({ maxActionsPerDay: 5 }), state);
    expect(decision.shouldRun).toBe(false);
    expect(decision.reason).toContain("maxActionsPerDay");
  });

  it("declines to run when the random roll misses runProbability", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const decision = decideTick(baseConfig({ runProbability: 0.1 }), emptyState());
    expect(decision.shouldRun).toBe(false);
  });

  it("runs when outside quiet hours, under the daily cap, and the roll hits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.0);
    const decision = decideTick(baseConfig({ runProbability: 1 }), emptyState());
    expect(decision.shouldRun).toBe(true);
  });
});
