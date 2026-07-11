import { run, runInherit } from "./exec.js";

export interface OpenPR {
  number: number;
  title: string;
  headRefName: string;
}

async function gh(args: string[]): Promise<string> {
  const result = await run("gh", args);
  if (result.code !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export async function listOpenPRs(repo: string): Promise<OpenPR[]> {
  const out = await gh([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--json",
    "number,title,headRefName",
  ]);
  return out ? (JSON.parse(out) as OpenPR[]) : [];
}

export async function createPullRequest(
  repo: string,
  opts: { base: string; head: string; title: string; body: string },
): Promise<string> {
  return gh([
    "pr",
    "create",
    "--repo",
    repo,
    "--base",
    opts.base,
    "--head",
    opts.head,
    "--title",
    opts.title,
    "--body",
    opts.body,
  ]);
}

export type ReviewEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

export async function reviewPullRequest(
  repo: string,
  number: number,
  opts: { event: ReviewEvent; body: string },
): Promise<void> {
  const eventFlag =
    opts.event === "APPROVE"
      ? "--approve"
      : opts.event === "REQUEST_CHANGES"
        ? "--request-changes"
        : "--comment";
  await gh(["pr", "review", String(number), "--repo", repo, eventFlag, "--body", opts.body]);
}

export async function createIssue(
  repo: string,
  opts: { title: string; body: string; labels?: string[] },
): Promise<string> {
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    opts.title,
    "--body",
    opts.body,
  ];
  if (opts.labels && opts.labels.length > 0) {
    args.push("--label", opts.labels.join(","));
  }
  return gh(args);
}

export async function prDiff(repo: string, number: number): Promise<string> {
  const result = await run("gh", ["pr", "diff", String(number), "--repo", repo]);
  // A PR with no diff (rare) exits non-zero with empty output; anything else is a real error.
  if (result.code !== 0 && result.stdout.trim().length === 0 && result.stderr.trim().length > 0) {
    throw new Error(`gh pr diff failed: ${result.stderr}`);
  }
  return result.stdout;
}

export async function listOpenIssueTitles(repo: string): Promise<string[]> {
  const out = await gh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--json",
    "title",
  ]);
  const issues = out ? (JSON.parse(out) as { title: string }[]) : [];
  return issues.map((i) => i.title);
}

/**
 * Wires git's credential helper to gh's stored/env token so plain
 * `https://github.com/owner/repo.git` clone/push URLs authenticate without
 * ever embedding the token in a URL, argv, or remote config (all of which
 * can leak into logs or `git remote -v`).
 */
export async function setupGitCredentialHelper(): Promise<void> {
  await gh(["auth", "setup-git"]);
}

export function httpsCloneUrl(repo: string): string {
  return `https://github.com/${repo}.git`;
}

export async function isGhAuthenticated(): Promise<boolean> {
  const result = await run("gh", ["auth", "status"]);
  return result.code === 0;
}

export async function loginGhInteractively(): Promise<void> {
  const code = await runInherit("gh", ["auth", "login"]);
  if (code !== 0) {
    throw new Error("gh auth login failed or was cancelled");
  }
}

export interface GhUser {
  login: string;
  id: number;
  name: string | null;
}

export async function getAuthenticatedUser(): Promise<GhUser> {
  const out = await gh(["api", "user", "--jq", "{login:.login,id:.id,name:.name}"]);
  return JSON.parse(out) as GhUser;
}

export interface GhRepoListItem {
  nameWithOwner: string;
  isPrivate: boolean;
  description: string | null;
}

export async function listUserRepos(limit = 100): Promise<GhRepoListItem[]> {
  const out = await gh([
    "repo",
    "list",
    "--limit",
    String(limit),
    "--json",
    "nameWithOwner,isPrivate,description",
  ]);
  return out ? (JSON.parse(out) as GhRepoListItem[]) : [];
}
