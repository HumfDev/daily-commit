import { run } from "./exec.js";

export interface GitOptions {
  cwd: string;
}

async function git(args: string[], opts: GitOptions): Promise<string> {
  const result = await run("git", args, { cwd: opts.cwd });
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export async function cloneShallow(repoUrl: string, dest: string): Promise<void> {
  const result = await run("git", ["clone", "--depth=1", repoUrl, dest]);
  if (result.code !== 0) {
    throw new Error(`git clone failed: ${result.stderr}`);
  }
}

export async function checkoutNewBranch(branch: string, opts: GitOptions): Promise<void> {
  await git(["checkout", "-b", branch], opts);
}

export async function configureIdentity(
  name: string,
  email: string,
  opts: GitOptions,
): Promise<void> {
  await git(["config", "user.name", name], opts);
  await git(["config", "user.email", email], opts);
}

/**
 * Porcelain lines are fixed-width (`XY<space>path`) with meaningful leading
 * spaces (e.g. " M path" for an unstaged modify) — a whole-string .trim()
 * on the raw output would eat the leading space of the first line and
 * corrupt its filename, so this reads stdout directly instead of going
 * through the trimming `git()` helper.
 */
export async function statusPorcelain(opts: GitOptions): Promise<string[]> {
  const result = await run("git", ["status", "--porcelain"], { cwd: opts.cwd });
  if (result.code !== 0) {
    throw new Error(`git status --porcelain failed: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

export async function changedFiles(opts: GitOptions): Promise<string[]> {
  const lines = await statusPorcelain(opts);
  return lines.map((line) => line.slice(3).trim());
}

export async function addAll(opts: GitOptions): Promise<void> {
  await git(["add", "-A"], opts);
}

export async function addPath(path: string, opts: GitOptions): Promise<void> {
  await git(["add", "--", path], opts);
}

export async function commit(message: string, opts: GitOptions): Promise<void> {
  await git(["commit", "-m", message], opts);
}

export async function push(branch: string, opts: GitOptions): Promise<void> {
  await git(["push", "origin", branch], opts);
}

export async function currentDefaultBranch(opts: GitOptions): Promise<string> {
  const out = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], opts);
  return out.replace("refs/remotes/origin/", "");
}

/** The branch actually checked out right now (works reliably on shallow clones). */
export async function currentBranch(opts: GitOptions): Promise<string> {
  return git(["rev-parse", "--abbrev-ref", "HEAD"], opts);
}
