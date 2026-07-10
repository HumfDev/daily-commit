import { access } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../exec.js";

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

export interface OutdatedDepsResult {
  applicable: boolean;
  packages: OutdatedPackage[];
}

const MAX_SAMPLE = 10;

/**
 * Best-effort: only runs when the repo has a package.json, and treats any
 * failure (npm missing, no network, malformed output) as "nothing to
 * report" rather than crashing the whole daily run.
 */
export async function runOutdatedDepsCheck(repoDir: string): Promise<OutdatedDepsResult> {
  try {
    await access(join(repoDir, "package.json"));
  } catch {
    return { applicable: false, packages: [] };
  }

  const result = await run("npm", ["outdated", "--json"], { cwd: repoDir });
  // npm outdated exits 1 when it finds outdated packages — that's success for us.
  if (!result.stdout.trim()) {
    return { applicable: true, packages: [] };
  }

  try {
    const parsed = JSON.parse(result.stdout) as Record<
      string,
      { current?: string; wanted?: string; latest?: string }
    >;
    const packages = Object.entries(parsed)
      .slice(0, MAX_SAMPLE)
      .map(([name, info]) => ({
        name,
        current: info.current ?? "?",
        wanted: info.wanted ?? "?",
        latest: info.latest ?? "?",
      }));
    return { applicable: true, packages };
  } catch {
    return { applicable: true, packages: [] };
  }
}
