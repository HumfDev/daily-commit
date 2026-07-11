#!/usr/bin/env node
import { basename } from "node:path";
import { runDirectCommitAction, type CommitOutcome } from "./actions/commit.js";
import { runIssueAction, type IssueOutcome } from "./actions/issue.js";
import { runPullRequestAction, type PullRequestOutcome } from "./actions/pullrequest.js";
import { runReviewAction, type ReviewOutcome } from "./actions/review.js";
import { loadConfig, type ActionType, type GlobalConfig, type RepoEntry } from "./config.js";
import { setupGitCredentialHelper } from "./gh.js";
import { addPath, commit as gitCommit, configureIdentity, currentBranch, push } from "./git.js";
import { runInstall } from "./install.js";
import { runOnboard } from "./onboard/index.js";
import { pickRepoAndAction } from "./picker.js";
import { decideTick } from "./scheduler.js";
import { actionsToday, loadState, recordAction, saveState } from "./state.js";
import { createWorkspace, destroyWorkspace, type GitIdentity } from "./workspace.js";

type Outcome = CommitOutcome | PullRequestOutcome | IssueOutcome | ReviewOutcome;

function identityFrom(global: GlobalConfig): GitIdentity {
  return { name: global.gitAuthor, email: global.gitEmail };
}

async function dispatch(
  repo: RepoEntry,
  actionType: Exclude<ActionType, "noop">,
  dryRun: boolean,
  identity: GitIdentity,
): Promise<Outcome> {
  if (actionType === "review") {
    return runReviewAction(repo, dryRun);
  }

  const { global } = await loadConfig();
  const ws = await createWorkspace(repo.repo, identity);
  try {
    switch (actionType) {
      case "commit":
        return await runDirectCommitAction(ws, repo, global, dryRun);
      case "pull_request":
        return await runPullRequestAction(ws, repo, global, dryRun);
      case "issue":
        return await runIssueAction(ws, repo, dryRun);
    }
  } finally {
    await destroyWorkspace(ws);
  }
}

async function persistState(
  repo: string,
  actionType: ActionType,
  identity: GitIdentity,
): Promise<void> {
  const state = await loadState();
  const next = recordAction(state, repo, actionType);
  await saveState(next);

  await configureIdentity(identity.name, identity.email, { cwd: process.cwd() });
  await addPath(".dc-state.json", { cwd: process.cwd() });
  await gitCommit(`chore: record daily-commit run (${repo} ${actionType})`, { cwd: process.cwd() });
  const branch = await currentBranch({ cwd: process.cwd() });
  await push(branch, { cwd: process.cwd() });
}

async function runCommand(dryRun: boolean): Promise<void> {
  const { global, repos } = await loadConfig();
  const identity = identityFrom(global);
  const state = await loadState();

  if (!dryRun) {
    const decision = decideTick(global, state);
    console.log(`[scheduler] ${decision.reason}`);
    if (!decision.shouldRun) return;
  } else {
    console.log("[scheduler] dry-run: bypassing tick gate");
  }

  await setupGitCredentialHelper();

  const selection = pickRepoAndAction(repos, global, state);
  console.log(`[picker] repo=${selection.repo.repo} action=${selection.actionType}`);

  if (selection.actionType === "noop") {
    console.log("[result] noop — nothing to do this tick");
    return;
  }

  const outcome = await dispatch(selection.repo, selection.actionType, dryRun, identity);
  console.log("[result]", JSON.stringify(outcome, null, 2));

  if (!dryRun && outcome.performed) {
    await persistState(selection.repo.repo, selection.actionType, identity);
    console.log(
      `[state] recorded run (today's total: ${actionsToday(await loadState()) }/${global.maxActionsPerDay})`,
    );
  }
}

function printUsage(): void {
  console.error(`daily commit (dc)

Usage:
  npx install-daily-commit [dir]   Download, install deps, run onboard
  dc install [dir]                 Same, from an existing checkout
  dc onboard                       Interactive setup (GitHub account + repos)
  dc run                           Run one daily-commit tick
  dc dry-run                       Same as run, without remote write APIs`);
}

function invokedAsInstaller(): boolean {
  const bin = basename(process.argv[1] ?? "").replace(/\.(js|mjs|cjs)$/i, "");
  return bin === "install-daily-commit" || bin === "daily-commit";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    if (invokedAsInstaller()) {
      await runInstall("daily-commit");
      return;
    }
    printUsage();
    return;
  }

  if (command === "install") {
    await runInstall(args[1] ?? "daily-commit");
    return;
  }

  if (command === "onboard") {
    await runOnboard();
    return;
  }

  if (command === "run") {
    await runCommand(args.includes("--dry-run"));
    return;
  }

  if (command === "dry-run") {
    await runCommand(true);
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  // `npx install-daily-commit my-dir` → install into my-dir
  if (invokedAsInstaller() && !command.startsWith("-")) {
    await runInstall(command);
    return;
  }

  printUsage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
