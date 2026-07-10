import { runDirectCommitAction, type CommitOutcome } from "./actions/commit.js";
import { runIssueAction, type IssueOutcome } from "./actions/issue.js";
import { runPullRequestAction, type PullRequestOutcome } from "./actions/pullrequest.js";
import { runReviewAction, type ReviewOutcome } from "./actions/review.js";
import { loadConfig, type ActionType, type RepoEntry } from "./config.js";
import { setupGitCredentialHelper } from "./gh.js";
import { addPath, commit as gitCommit, configureIdentity, currentBranch, push } from "./git.js";
import { pickRepoAndAction } from "./picker.js";
import { decideTick } from "./scheduler.js";
import { actionsToday, loadState, recordAction, saveState } from "./state.js";
import { BOT_EMAIL, BOT_NAME, createWorkspace, destroyWorkspace } from "./workspace.js";

type Outcome = CommitOutcome | PullRequestOutcome | IssueOutcome | ReviewOutcome;

async function dispatch(
  repo: RepoEntry,
  actionType: Exclude<ActionType, "noop">,
  dryRun: boolean,
): Promise<Outcome> {
  if (actionType === "review") {
    return runReviewAction(repo, dryRun);
  }

  const { global } = await loadConfig();
  const ws = await createWorkspace(repo.repo);
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

async function persistState(repo: string, actionType: ActionType): Promise<void> {
  const state = await loadState();
  const next = recordAction(state, repo, actionType);
  await saveState(next);

  await configureIdentity(BOT_NAME, BOT_EMAIL, { cwd: process.cwd() });
  await addPath(".upkeep-state.json", { cwd: process.cwd() });
  await gitCommit(`chore: record upkeep run (${repo} ${actionType})`, { cwd: process.cwd() });
  const branch = await currentBranch({ cwd: process.cwd() });
  await push(branch, { cwd: process.cwd() });
}

async function runCommand(dryRun: boolean): Promise<void> {
  const { global, repos } = await loadConfig();
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

  const outcome = await dispatch(selection.repo, selection.actionType, dryRun);
  console.log("[result]", JSON.stringify(outcome, null, 2));

  if (!dryRun && outcome.performed) {
    await persistState(selection.repo.repo, selection.actionType);
    console.log(
      `[state] recorded run (today's total: ${actionsToday(await loadState()) }/${global.maxActionsPerDay})`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "run";
  const dryRun = args.includes("--dry-run");

  if (command !== "run") {
    console.error(`Unknown command "${command}". Usage: repo-upkeep run [--dry-run]`);
    process.exit(1);
  }

  await runCommand(dryRun);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
