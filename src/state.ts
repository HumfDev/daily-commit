import { readFile, writeFile } from "node:fs/promises";

export interface UpkeepState {
  lastRun: Record<string, string>; // `${repo}:${actionType}` -> ISO timestamp
  dailyCount: Record<string, number>; // `YYYY-MM-DD` -> count
}

const DEFAULT_STATE: UpkeepState = { lastRun: {}, dailyCount: {} };

export async function loadState(path = ".upkeep-state.json"): Promise<UpkeepState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<UpkeepState>;
    return { lastRun: parsed.lastRun ?? {}, dailyCount: parsed.dailyCount ?? {} };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: UpkeepState, path = ".upkeep-state.json"): Promise<void> {
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function recordAction(state: UpkeepState, repo: string, actionType: string): UpkeepState {
  const now = new Date();
  const key = `${repo}:${actionType}`;
  const dateKey = now.toISOString().slice(0, 10);
  return {
    lastRun: { ...state.lastRun, [key]: now.toISOString() },
    dailyCount: { ...state.dailyCount, [dateKey]: (state.dailyCount[dateKey] ?? 0) + 1 },
  };
}

export function actionsToday(state: UpkeepState): number {
  const dateKey = new Date().toISOString().slice(0, 10);
  return state.dailyCount[dateKey] ?? 0;
}

export function hoursSinceLastRun(state: UpkeepState, repo: string, actionType: string): number {
  const key = `${repo}:${actionType}`;
  const last = state.lastRun[key];
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
}
