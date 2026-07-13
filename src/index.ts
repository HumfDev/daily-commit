#!/usr/bin/env node
import { basename } from "node:path";
import { runDirectCommitAction, type CommitOutcome } from "./actions/commit.js";
import { runIssueAction, type IssueOutcome } from "./actions/issue.js";
import { runPullRequestAction, type PullRequestOutcome } from "./actions/pullrequest.js";
import { runReviewAction, type ReviewOutcome } from "./actions/review.js";
import { loadConfig, type ActionType, type GlobalConfig, type RepoEntry } from "./config.js";
import { setupGitCredentialHelper } from "./gh.js";
import { runInstall } from "./install.js";
import { runOnboard } from "./onboard/index.js";
import {
  actionAttemptsForRepo,
  pickRepoAndAction,
  reposNeedingActions,
} from "./picker.js";
import { decideTick } from "./scheduler.js";
import {
  actionsToday,
  actionsTodayForRepo,
  loadState,
  recordAction,
  saveState,
  type DcState,
} from "./state.js";
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

async function tryActionsOnRepo(
  repo: RepoEntry,
  global: GlobalConfig,
  state: DcState,
  dryRun: boolean,
  identity: GitIdentity,
  catchUp: boolean,
): Promise<{ actionType: ActionType; outcome: Outcome } | null> {
  const attempts = actionAttemptsForRepo(repo, global, state, catchUp);
  if (attempts.length === 0) {
    console.log(`[skip] ${repo.repo}: no actions enabled`);
    return null;
  }

  for (const actionType of attempts) {
    console.log(`[attempt] repo=${repo.repo} action=${actionType}`);
    const outcome = await dispatch(repo, actionType, dryRun, identity);
    console.log(`[result] ${repo.repo} ${actionType}`, JSON.stringify(outcome));
    if (outcome.performed) {
      return { actionType, outcome };
    }
  }

  console.log(`[fail] ${repo.repo}: no successful action this pass`);
  return null;
}

async function runCommand(dryRun: boolean): Promise<void> {
  const { global, repos } = await loadConfig();
  const identity = identityFrom(global);
  let state = await loadState();

  const decision = dryRun
    ? {
        shouldRun: true,
        reason: "dry-run: bypassing tick gate",
        catchUp: reposNeedingActions(repos, global, state).length > 0,
      }
    : decideTick(global, state, repos);

  console.log(`[scheduler] ${decision.reason}`);
  if (!decision.shouldRun) return;

  await setupGitCredentialHelper();

  if (decision.catchUp || dryRun) {
    const pending = reposNeedingActions(repos, global, state);
    if (pending.length === 0) {
      console.log("[catch-up] every selected repo already met today's minimum");
      if (dryRun) {
        // Still exercise one random repo so dry-run stays useful for debugging.
        const selection = pickRepoAndAction(repos, global, state);
        if (selection.actionType === "noop") {
          console.log("[result] noop — nothing to do");
          return;
        }
        await tryActionsOnRepo(selection.repo, global, state, true, identity, false);
      }
      return;
    }

    console.log(
      `[catch-up] processing ${pending.length} repo(s) (min ${global.minActionsPerRepoPerDay}/repo/day)`,
    );

    for (const repo of pending) {
      state = await loadState();
      if (actionsTodayForRepo(state, repo.repo) >= global.minActionsPerRepoPerDay) {
        continue;
      }

      const result = await tryActionsOnRepo(repo, global, state, dryRun, identity, true);
      if (!dryRun && result?.outcome.performed) {
        state = recordAction(state, repo.repo, result.actionType);
        await saveState(state);
        console.log(
          `[state] ${repo.repo} today=${actionsTodayForRepo(state, repo.repo)}/${global.minActionsPerRepoPerDay} (global ${actionsToday(state)})`,
        );
      }
    }

    state = await loadState();
    const still = reposNeedingActions(repos, global, state);
    console.log(
      `[done] catch-up finished; ${repos.length - still.length}/${repos.length} repos met today's minimum`,
    );
    return;
  }

  // Bonus tick: single random repo/action after all mins are met.
  const selection = pickRepoAndAction(repos, global, state);
  console.log(`[picker] repo=${selection.repo.repo} action=${selection.actionType}`);
  if (selection.actionType === "noop") {
    console.log("[result] noop — nothing to do this tick");
    return;
  }

  const result = await tryActionsOnRepo(
    selection.repo,
    global,
    state,
    dryRun,
    identity,
    false,
  );
  if (!dryRun && result?.outcome.performed) {
    state = recordAction(state, selection.repo.repo, result.actionType);
    await saveState(state);
    console.log(`[state] recorded (today's total: ${actionsToday(state)})`);
  }
}

function printUsage(): void {
  console.error(`daily commit (dc)

Usage:
  npx daily-commit                 Download, install deps, run onboard
  npx daily-commit@latest -- my-dir
  dc install [dir]                 Same, from an existing checkout
  dc onboard                       Interactive setup (GitHub account + repos)
  dc run                           Catch up: ≥1 success/day per selected repo
  dc dry-run                       Same as run, without remote write APIs

From the install folder:
  cd ~/daily-commit && npx dc run`);
}

function invokedAsInstaller(): boolean {
  const bin = basename(process.argv[1] ?? "").replace(/\.(js|mjs|cjs)$/i, "");
  return bin === "daily-commit";
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
