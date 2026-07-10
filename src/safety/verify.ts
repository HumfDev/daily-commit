import { run } from "../exec.js";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Runs the repo owner's own configured verify command (e.g. their test or
 * build script) inside the clone, as a second safety gate on top of the
 * allowlist. A non-zero exit aborts the action — nothing gets pushed.
 *
 * verifyCommand comes from the repo owner's own repos.yml, not from PR/repo
 * content, so shelling it out via `sh -c` is the same trust boundary as a
 * package.json script the owner already runs themselves.
 */
export async function runVerifyCommand(
  verifyCommand: string | undefined,
  cwd: string,
): Promise<VerifyResult> {
  if (!verifyCommand || verifyCommand.trim().length === 0) {
    return { ok: true };
  }
  const result = await run("sh", ["-c", verifyCommand], { cwd });
  if (result.code !== 0) {
    return {
      ok: false,
      reason: `verifyCommand "${verifyCommand}" exited ${result.code}: ${result.stderr.slice(0, 2000)}`,
    };
  }
  return { ok: true };
}
