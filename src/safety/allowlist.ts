import { minimatch } from "minimatch";

/**
 * The core "never change functionality" guarantee: every file a commit/PR
 * action touches must match at least one configured safe-path glob. Any
 * unmatched file aborts the whole action before anything is staged.
 */
export function isAllowed(filePath: string, safePaths: string[]): boolean {
  return safePaths.some((pattern) => minimatch(filePath, pattern, { dot: true }));
}

export interface AllowlistResult {
  ok: boolean;
  violations: string[];
}

export function checkAllowlist(changedFiles: string[], safePaths: string[]): AllowlistResult {
  const violations = changedFiles.filter((f) => !isAllowed(f, safePaths));
  return { ok: violations.length === 0, violations };
}
