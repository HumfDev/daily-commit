import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Runs a command via execFile (no shell) so arguments are never subject to
 * shell interpolation. This is the only place child processes are spawned —
 * every GitHub/git operation in this project funnels through here.
 */
export async function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      maxBuffer: 1024 * 1024 * 32,
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message: string };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message,
      code: typeof e.code === "number" ? e.code : 1,
    };
  }
}

/** Interactive commands (e.g. `gh auth login`) that need a real TTY. */
export function runInherit(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: opts.cwd,
      env: opts.env ?? process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
