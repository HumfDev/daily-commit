import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import {
  getAuthenticatedUser,
  isGhAuthenticated,
  listUserRepos,
  loginGhInteractively,
} from "../gh.js";
import { run } from "../exec.js";
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
      "Select repos this bot may act on:",
      listed.map(formatRepoLabel),
    );
    const selected = indices.map((i) => listed[i]!.nameWithOwner);

    const addMore = await confirm("Add another repo by owner/name (not in the list)?", false);
    if (!addMore) return selected;

    const extra = await ask('Extra repo (owner/name, or empty to skip)');
    if (extra && /^[\w.-]+\/[\w.-]+$/.test(extra)) {
      if (!selected.includes(extra)) selected.push(extra);
    } else if (extra) {
      console.log(`Skipping invalid repo name: ${extra}`);
    }
    return selected;
  }

  const manual = await ask('Enter a repo as owner/name (required)');
  if (!manual || !/^[\w.-]+\/[\w.-]+$/.test(manual)) {
    throw new Error("At least one valid owner/name repo is required.");
  }
  return [manual];
}

export async function runOnboard(cwd = process.cwd()): Promise<void> {
  console.log(`
daily commit onboarding
-----------------------
This will configure:
  • your GitHub identity (so commits look like you)
  • which repos the bot may touch
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

  console.log(`\nWill configure ${repoNames.length} repo(s):`);
  for (const name of repoNames) console.log(`  • ${name}`);

  const configPath = `${cwd}/config.yml`;
  const reposPath = `${cwd}/repos.yml`;

  if ((await fileExists(configPath)) || (await fileExists(reposPath))) {
    const overwrite = await confirm(
      "config.yml / repos.yml already exist. Overwrite with onboarding choices?",
      false,
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

  console.log(`
✓ Wrote ${configPath}
✓ Wrote ${reposPath}

Next steps
----------
1. Create a fine-grained PAT for ${user.login} with contents, pull-requests,
   and issues write access to every selected repo (and this control repo).
2. Add it as a GitHub Actions secret named DC_PAT on this control repo.
3. Push this repo to GitHub so .github/workflows/daily.yml can run.
4. Test locally:  dc dry-run
`);
}
