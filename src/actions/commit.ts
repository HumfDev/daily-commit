import type { GlobalConfig, RepoEntry } from "../config.js";
import { safePathsFor } from "../config.js";
import { addAll, changedFiles, commit as gitCommit, currentBranch, push } from "../git.js";
import { applyRandomMutation } from "../mutations.js";
import { checkAllowlist } from "../safety/allowlist.js";
import { runVerifyCommand } from "../safety/verify.js";
import { commitMessage, type MutationKind } from "../templates/text.js";
import type { Workspace } from "../workspace.js";

export interface CommitOutcome {
  performed: boolean;
  reason?: string;
  filePath?: string;
  mutationKind?: MutationKind;
  message?: string;
  dryRun?: boolean;
}

/**
 * Applies one safe mutation, verifies it against the allowlist + the repo's
 * own verify command, and commits (no push — callers decide whether this
 * becomes a direct-commit or feeds a pull_request action).
 */
export async function applyCommit(
  ws: Workspace,
  repo: RepoEntry,
  global: GlobalConfig,
): Promise<CommitOutcome> {
  const safePaths = safePathsFor(repo, global);

  const mutation = await applyRandomMutation(ws.dir);

  const files = await changedFiles({ cwd: ws.dir });
  if (files.length === 0) {
    return { performed: false, reason: "mutation produced no changes" };
  }

  const allowlist = checkAllowlist(files, safePaths);
  if (!allowlist.ok) {
    return {
      performed: false,
      reason: `blocked by allowlist: ${allowlist.violations.join(", ")}`,
    };
  }

  const verify = await runVerifyCommand(repo.verifyCommand, ws.dir);
  if (!verify.ok) {
    return { performed: false, reason: verify.reason };
  }

  const message = commitMessage(mutation.kind, mutation.filePath);
  await addAll({ cwd: ws.dir });
  await gitCommit(message, { cwd: ws.dir });

  return {
    performed: true,
    filePath: mutation.filePath,
    mutationKind: mutation.kind,
    message,
  };
}

/**
 * "commit" action type: applies + commits + pushes straight to the default
 * branch. Only reachable because applyCommit already enforced the allowlist
 * and verify gate — this is the low-risk path for pure docs/formatting.
 */
export async function runDirectCommitAction(
  ws: Workspace,
  repo: RepoEntry,
  global: GlobalConfig,
  dryRun = false,
): Promise<CommitOutcome> {
  const outcome = await applyCommit(ws, repo, global);
  if (!outcome.performed) return outcome;

  if (dryRun) {
    return { ...outcome, dryRun: true };
  }

  const branch = await currentBranch({ cwd: ws.dir });
  await push(branch, { cwd: ws.dir });
  return outcome;
}
