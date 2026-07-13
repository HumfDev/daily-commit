import { readFile, writeFile } from "node:fs/promises";

export interface DcState {
  lastRun: Record<string, string>; // `${repo}:${actionType}` -> ISO timestamp
  dailyCount: Record<string, number>; // `YYYY-MM-DD` -> total successful actions
  /** Successful actions per calendar day per repo. */
  dailyRepoCount: Record<string, Record<string, number>>;
}

const DEFAULT_STATE: DcState = { lastRun: {}, dailyCount: {}, dailyRepoCount: {} };

const STATE_PATH = ".dc-state.json";
const LEGACY_STATE_PATH = ".upkeep-state.json";

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function loadState(path = STATE_PATH): Promise<DcState> {
  for (const candidate of path === STATE_PATH ? [STATE_PATH, LEGACY_STATE_PATH] : [path]) {
    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as Partial<DcState>;
      return {
        lastRun: parsed.lastRun ?? {},
        dailyCount: parsed.dailyCount ?? {},
        dailyRepoCount: parsed.dailyRepoCount ?? {},
      };
    } catch {
      // try next
    }
  }
  return { ...DEFAULT_STATE, dailyRepoCount: {} };
}

export async function saveState(state: DcState, path = STATE_PATH): Promise<void> {
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function recordAction(state: DcState, repo: string, actionType: string): DcState {
  const now = new Date();
  const key = `${repo}:${actionType}`;
  const dateKey = todayKey(now);
  const byRepo = { ...(state.dailyRepoCount[dateKey] ?? {}) };
  byRepo[repo] = (byRepo[repo] ?? 0) + 1;

  return {
    lastRun: { ...state.lastRun, [key]: now.toISOString() },
    dailyCount: { ...state.dailyCount, [dateKey]: (state.dailyCount[dateKey] ?? 0) + 1 },
    dailyRepoCount: { ...state.dailyRepoCount, [dateKey]: byRepo },
  };
}

export function actionsToday(state: DcState): number {
  return state.dailyCount[todayKey()] ?? 0;
}

export function actionsTodayForRepo(state: DcState, repo: string): number {
  return state.dailyRepoCount[todayKey()]?.[repo] ?? 0;
}

export function hoursSinceLastRun(state: DcState, repo: string, actionType: string): number {
  const key = `${repo}:${actionType}`;
  const last = state.lastRun[key];
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
}
