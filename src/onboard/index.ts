import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import {
  createGithubRepo,
  getAuthToken,
  getAuthenticatedUser,
  isGhAuthenticated,
  listUserRepos,
  loginGhInteractively,
  repoExists,
  setActionsSecret,
} from "../gh.js";
import { run, runInherit } from "../exec.js";
import { ask, confirm, selectIndices } from "../prompt.js";
import {
  buildRepoEntries,
  defaultGitAuthor,
  defaultOnboardConfig,
  noreplyEmail,
  renderConfigYaml,
  renderReposYaml,
  type ListedRepo,
} from "./configWrite.js";

const TEMPLATE_REPO = process.env.DC_REPO ?? "HumfDev/daily-commit";

async function ensureGhCli(): Promise<void> {
  const result = await run("gh", ["--version"]);
  if (result.code !== 0) {
    throw new Error(
      "GitHub CLI (gh) is required. Install it from https://cli.github.com/ then re-run onboard.",
    );
  }
}

async function ensureAuthenticated(): Promise<void> {
  if (await isGhAuthenticated()) {
    console.log("✓ Already logged into GitHub CLI");
    return;
  }
  console.log("\nYou need to log into GitHub so we can list your repos and set your identity.");
  const ok = await confirm("Start `gh auth login` now?", true);
  if (!ok) {
    throw new Error("GitHub authentication is required to continue onboarding.");
  }
  await loginGhInteractively();
  if (!(await isGhAuthenticated())) {
    throw new Error("Still not authenticated after gh auth login.");
  }
  console.log("✓ Logged into GitHub CLI");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function formatRepoLabel(repo: ListedRepo): string {
  const visibility = repo.isPrivate ? "private" : "public";
  const desc = repo.description ? ` — ${repo.description.slice(0, 60)}` : "";
  return `${repo.nameWithOwner} (${visibility})${desc}`;
}

async function pickRepos(listed: ListedRepo[]): Promise<string[]> {
  if (listed.length === 0) {
    console.log("\nNo repos returned by `gh repo list`.");
  } else {
    const indices = await selectIndices(
      "Select target repos daily-commit may act on (commits/PRs/reviews/issues):",
      listed.map(formatRepoLabel),
    );
    const selected = indices.map((i) => listed[i]!.nameWithOwner);

    const addMore = await confirm("Add another repo by owner/name (not in the list)?", false);
    if (!addMore) return selected;

    const extra = await ask("Extra repo (owner/name, or empty to skip)");
    if (extra && /^[\w.-]+\/[\w.-]+$/.test(extra)) {
      if (!selected.includes(extra)) selected.push(extra);
    } else if (extra) {
      console.log(`Skipping invalid repo name: ${extra}`);
    }
    return selected;
  }

  const manual = await ask("Enter a repo as owner/name (required)");
  if (!manual || !/^[\w.-]+\/[\w.-]+$/.test(manual)) {
    throw new Error("At least one valid owner/name repo is required.");
  }
  return [manual];
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await run("git", args, { cwd });
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

async function currentOriginRepo(cwd: string): Promise<string | null> {
  const result = await run("git", ["remote", "get-url", "origin"], { cwd });
  if (result.code !== 0) return null;
  const url = result.stdout.trim();
  const m =
    url.match(/github\.com[:/](?<owner>[\w.-]+)\/(?<name>[\w.-]+?)(?:\.git)?$/i) ??
    url.match(/github\.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)/i);
  if (!m?.groups) return null;
  return `${m.groups.owner}/${m.groups.name.replace(/\.git$/, "")}`;
}

/**
 * Ensures this install has a control repo under the user's account (not the
 * public template), commits config, pushes, and sets DC_PAT for Actions.
 */
async function setupControlRepo(
  cwd: string,
  login: string,
): Promise<{ controlRepo: string; pushed: boolean; secretSet: boolean }> {
  console.log(`
Control repo
------------
daily-commit needs its own GitHub repo under *your* account to run Actions.
(The template ${TEMPLATE_REPO} is only the installer source.)
`);

  const defaultName =
    `${login}/daily-commit`.toLowerCase() === TEMPLATE_REPO.toLowerCase()
      ? `${login}/my-daily-commit`
      : `${login}/daily-commit`;
  let controlRepo = await ask("Control repo (owner/name)", defaultName);
  if (!/^[\w.-]+\/[\w.-]+$/.test(controlRepo)) {
    throw new Error(`Invalid control repo '${controlRepo}'`);
  }

  const origin = await currentOriginRepo(cwd);
  const isTemplateOrigin =
    origin !== null && origin.toLowerCase() === TEMPLATE_REPO.toLowerCase();

  if (!(await repoExists(controlRepo))) {
    const create = await confirm(`Create private GitHub repo ${controlRepo} now?`, true);
    if (!create) {
      throw new Error(`Create ${controlRepo} on GitHub, then re-run: npx dc onboard`);
    }
    const isPrivate = await confirm("Make the control repo private?", true);
    await createGithubRepo(controlRepo, {
      privateRepo: isPrivate,
      description: "daily-commit control repo",
    });
    console.log(`✓ Created ${controlRepo}`);
  } else {
    console.log(`✓ Using existing ${controlRepo}`);
  }

  // Point origin at the user's control repo (keep template as upstream if present).
  if (isTemplateOrigin) {
    const hasUpstream = (await run("git", ["remote", "get-url", "upstream"], { cwd })).code === 0;
    if (!hasUpstream) {
      await git(cwd, ["remote", "rename", "origin", "upstream"]);
    } else {
      await git(cwd, ["remote", "remove", "origin"]);
    }
    await git(cwd, ["remote", "add", "origin", `https://github.com/${controlRepo}.git`]);
  } else if (!origin) {
    await git(cwd, ["remote", "add", "origin", `https://github.com/${controlRepo}.git`]);
  } else if (origin.toLowerCase() !== controlRepo.toLowerCase()) {
    await git(cwd, ["remote", "set-url", "origin", `https://github.com/${controlRepo}.git`]);
  }

  await git(cwd, ["add", "config.yml", "repos.yml"]);
  const staged = await run("git", ["diff", "--cached", "--quiet"], { cwd });
  if (staged.code !== 0) {
    // something staged
    await git(cwd, ["config", "user.email", "noreply@users.noreply.github.com"]);
    await git(cwd, ["config", "user.name", "daily-commit"]);
    await git(cwd, ["commit", "-m", "chore: configure daily-commit via onboard"]);
    console.log("✓ Committed config.yml + repos.yml");
  } else {
    // maybe nothing to commit if identical — still try add/status
    console.log("• No config changes to commit (already up to date)");
  }

  let pushed = false;
  if (await confirm(`Push to ${controlRepo} and enable Actions?`, true)) {
    // Prefer pushing current HEAD to main on a fresh control repo.
    let pushCode = await runInherit("git", ["push", "-u", "origin", "HEAD:main"], { cwd });
    if (pushCode !== 0) {
      pushCode = await runInherit("git", ["push", "-u", "origin", "HEAD"], { cwd });
    }
    if (pushCode !== 0) {
      throw new Error(
        `git push to ${controlRepo} failed. Fix the remote, push manually, then run: npx dc onboard`,
      );
    }
    pushed = true;
    console.log(`✓ Pushed to https://github.com/${controlRepo}`);
  }

  let secretSet = false;
  if (
    await confirm(
      "Store your current gh login as Actions secret DC_PAT on the control repo?\n" +
        "  (Needed so scheduled runs can commit/PR/review/issue on your target repos.)",
      true,
    )
  ) {
    const token = await getAuthToken();
    await setActionsSecret(controlRepo, "DC_PAT", token);
    secretSet = true;
    console.log("✓ Set Actions secret DC_PAT");
  }

  return { controlRepo, pushed, secretSet };
}

export async function runOnboard(cwd = process.cwd()): Promise<void> {
  console.log(`
daily commit onboarding
-----------------------
This will configure everything needed to run:
  • your GitHub account (commit author identity)
  • which repos the bot may touch
  • your control repo on GitHub + DC_PAT for Actions
`);

  await ensureGhCli();
  await ensureAuthenticated();

  const user = await getAuthenticatedUser();
  console.log(`\nAuthenticated as ${user.login} (id ${user.id})`);

  const gitAuthor = await ask("Commit author name", defaultGitAuthor(user));
  const gitEmail = await ask("Commit author email", noreplyEmail(user));

  console.log("\nFetching your repositories…");
  const listed = await listUserRepos(100);
  const repoNames = await pickRepos(listed);

  if (repoNames.length === 0) {
    throw new Error("Select at least one repository.");
  }

  console.log(`\nWill configure ${repoNames.length} target repo(s):`);
  for (const name of repoNames) console.log(`  • ${name}`);

  const configPath = `${cwd}/config.yml`;
  const reposPath = `${cwd}/repos.yml`;

  if ((await fileExists(configPath)) || (await fileExists(reposPath))) {
    const overwrite = await confirm(
      "config.yml / repos.yml already exist. Overwrite with onboarding choices?",
      true,
    );
    if (!overwrite) {
      console.log("Aborted — existing files left unchanged.");
      return;
    }
  }

  const config = defaultOnboardConfig({ gitAuthor, gitEmail });
  const repos = buildRepoEntries(repoNames);

  await writeFile(configPath, renderConfigYaml(config), "utf8");
  await writeFile(reposPath, renderReposYaml(repos), "utf8");
  console.log(`\n✓ Wrote ${configPath}`);
  console.log(`✓ Wrote ${reposPath}`);

  const { controlRepo, pushed, secretSet } = await setupControlRepo(cwd, user.login);

  console.log(`
✓ Onboarding complete

Control repo:  https://github.com/${controlRepo}
Targets:       ${repoNames.join(", ")}
Author:        ${gitAuthor} <${gitEmail}>
DC_PAT secret: ${secretSet ? "set" : "NOT set — add it before Actions can run"}
Pushed:        ${pushed ? "yes" : "no — push when ready"}

Test locally (from this folder):
  npx dc dry-run
  npx dc run

Trigger Actions:
  gh workflow run daily-commit --repo ${controlRepo}
`);
}
