import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import {
  getAuthenticatedUser,
  isGhAuthenticated,
  listUserRepos,
  loginWithToken,
} from "../gh.js";
import { run, runInherit } from "../exec.js";
import { ask, askSecret, confirm, selectIndices } from "../prompt.js";
import {
  buildRepoEntries,
  defaultGitAuthor,
  defaultOnboardConfig,
  noreplyEmail,
  renderConfigYaml,
  renderReposYaml,
  type ListedRepo,
} from "./configWrite.js";

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

  console.log(`
GitHub authentication (terminal only)
-------------------------------------
A browser login UI will NOT be opened.

1. Create a token at: https://github.com/settings/tokens
   - Classic PAT: enable scope  repo
   - Or fine-grained: Contents + Pull requests + Issues (read/write)
     on every repo you will select
2. Paste the token below (input is masked).
`);

  const token = await askSecret("Paste GitHub token");
  if (!token) {
    throw new Error("A GitHub token is required to continue onboarding.");
  }
  await loginWithToken(token);
  if (!(await isGhAuthenticated())) {
    throw new Error("Still not authenticated after token login.");
  }
  console.log("✓ Logged into GitHub CLI (token)");
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

async function offerCronInstall(cwd: string): Promise<boolean> {
  const script = resolve(cwd, "scripts/install-cron.sh");
  if (!(await fileExists(script))) {
    console.log("• scripts/install-cron.sh not found — add cron manually (see README)");
    return false;
  }

  if (!(await confirm("Install local cron to run daily-commit every 2 hours?", true))) {
    return false;
  }

  const code = await runInherit("bash", [script], { cwd });
  if (code !== 0) {
    console.log("• Cron install failed — run manually: bash scripts/install-cron.sh");
    return false;
  }
  return true;
}

export async function runOnboard(cwd = process.cwd()): Promise<void> {
  console.log(`
daily commit onboarding
-----------------------
All steps run in this terminal (stdin/stdout prompts only — no custom UI).

This will configure everything needed to run locally:
  • your GitHub account (commit author identity)
  • which repos the bot may touch
  • optional local cron schedule (your machine must be on)
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

  const cronInstalled = await offerCronInstall(cwd);

  console.log(`
✓ Onboarding complete

Install dir:   ${cwd}
Targets:       ${repoNames.join(", ")}
Author:        ${gitAuthor} <${gitEmail}>
Cron:          ${cronInstalled ? "installed (every 2h at :17)" : "not installed — see README"}

Test locally (from this folder):
  npx dc dry-run
  npx dc run

Install cron later:
  bash scripts/install-cron.sh
`);
}
