import { randomBytes } from "node:crypto";
import type { GlobalConfig, RepoEntry } from "../config.js";
import { checkoutNewBranch, currentBranch, push } from "../git.js";
import { createPullRequest } from "../gh.js";
import { prBody, prTitle } from "../templates/text.js";
import type { Workspace } from "../workspace.js";
import { applyCommit, type CommitOutcome } from "./commit.js";

export interface PullRequestOutcome extends CommitOutcome {
  url?: string;
}

function branchName(): string {
  return `dc/${randomBytes(4).toString("hex")}`;
}

export async function runPullRequestAction(
  ws: Workspace,
  repo: RepoEntry,
  global: GlobalConfig,
  dryRun = false,
): Promise<PullRequestOutcome> {
  const base = await currentBranch({ cwd: ws.dir });
  const branch = branchName();
  await checkoutNewBranch(branch, { cwd: ws.dir });

  const outcome = await applyCommit(ws, repo, global);
  if (!outcome.performed) {
    return outcome;
  }

  const details = outcome.filePath
    ? `Changed: \`${outcome.filePath}\``
    : "No file details available.";
  const title = prTitle();
  const body = prBody(details);

  if (dryRun) {
    return { ...outcome, dryRun: true, message: `${title}\n\n${body}` };
  }

  await push(branch, { cwd: ws.dir });
  const url = await createPullRequest(repo.repo, { base, head: branch, title, body });

  return { ...outcome, url };
}
