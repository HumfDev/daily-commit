import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { run, runInherit } from "./exec.js";
import { runOnboard } from "./onboard/index.js";

/** Source repo cloned into the user's machine during `dc install`. */
export const SOURCE_REPO = process.env.DC_REPO ?? "HumfDev/daily-commit";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureTools(): Promise<void> {
  for (const cmd of ["git", "node", "npm"] as const) {
    const args = cmd === "npm" ? ["--version"] : cmd === "git" ? ["--version"] : ["-v"];
    const result = await run(cmd, args);
    if (result.code !== 0) {
      throw new Error(`'${cmd}' is required but was not found on PATH.`);
    }
  }

  const version = (await run("node", ["-p", "process.versions.node"])).stdout.trim();
  const major = Number(version.split(".")[0]);
  if (!Number.isFinite(major) || major < 20) {
    throw new Error(`Node.js 20+ is required (found v${version || "unknown"}).`);
  }
}

async function cloneRepo(dest: string): Promise<void> {
  console.log(`→ Cloning github.com/${SOURCE_REPO} into ${dest}…`);

  const gh = await run("gh", ["--version"]);
  if (gh.code === 0) {
    const code = await runInherit("gh", ["repo", "clone", SOURCE_REPO, dest]);
    if (code !== 0) throw new Error(`gh repo clone ${SOURCE_REPO} failed`);
    return;
  }

  const code = await runInherit("git", [
    "clone",
    "--depth=1",
    `https://github.com/${SOURCE_REPO}.git`,
    dest,
  ]);
  if (code !== 0) throw new Error(`git clone ${SOURCE_REPO} failed`);
}

/**
 * One-shot installer: clone → npm install → interactive onboard.
 *
 *   npx install-daily-commit
 *   npx install-daily-commit my-dir
 */
export async function runInstall(targetDir = "daily-commit"): Promise<void> {
  await ensureTools();

  const dest = resolve(process.cwd(), targetDir);
  if (await pathExists(dest)) {
    throw new Error(
      `'${dest}' already exists. Pick another directory, e.g. \`npx install-daily-commit my-daily-commit\`.`,
    );
  }

  await mkdir(resolve(dest, ".."), { recursive: true });
  await cloneRepo(dest);

  console.log("→ Installing dependencies…");
  const npmCode = await runInherit("npm", ["install"], { cwd: dest });
  if (npmCode !== 0) throw new Error("npm install failed");

  console.log("→ Starting interactive onboarding…\n");
  const prev = process.cwd();
  process.chdir(dest);
  try {
    await runOnboard(dest);
  } finally {
    process.chdir(prev);
  }

  console.log(`
✓ Install complete.

Directory: ${dest}

Commands (from that folder — use npx so macOS's system \`dc\` calculator is not used):
  cd ${dest}
  npx dc onboard     # re-run setup
  npx dc dry-run     # safe test
  npx dc run         # live tick
`);
}
