import { readFile, writeFile } from "node:fs/promises";

export interface DcState {
  lastRun: Record<string, string>; // `${repo}:${actionType}` -> ISO timestamp
  dailyCount: Record<string, number>; // `YYYY-MM-DD` -> count
}

const DEFAULT_STATE: DcState = { lastRun: {}, dailyCount: {} };

const STATE_PATH = ".dc-state.json";
const LEGACY_STATE_PATH = ".upkeep-state.json";

export async function loadState(path = STATE_PATH): Promise<DcState> {
  for (const candidate of path === STATE_PATH ? [STATE_PATH, LEGACY_STATE_PATH] : [path]) {
    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as Partial<DcState>;
      return { lastRun: parsed.lastRun ?? {}, dailyCount: parsed.dailyCount ?? {} };
    } catch {
      // try next
    }
  }
  return { ...DEFAULT_STATE };
}

export async function saveState(state: DcState, path = STATE_PATH): Promise<void> {
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function recordAction(state: DcState, repo: string, actionType: string): DcState {
  const now = new Date();
  const key = `${repo}:${actionType}`;
  const dateKey = now.toISOString().slice(0, 10);
  return {
    lastRun: { ...state.lastRun, [key]: now.toISOString() },
    dailyCount: { ...state.dailyCount, [dateKey]: (state.dailyCount[dateKey] ?? 0) + 1 },
  };
}

export function actionsToday(state: DcState): number {
  const dateKey = new Date().toISOString().slice(0, 10);
  return state.dailyCount[dateKey] ?? 0;
}

export function hoursSinceLastRun(state: DcState, repo: string, actionType: string): number {
  const key = `${repo}:${actionType}`;
  const last = state.lastRun[key];
  if (!last) return Infinity;
  return (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
}
