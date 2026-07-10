import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneShallow, configureIdentity } from "./git.js";
import { httpsCloneUrl } from "./gh.js";

export const BOT_NAME = "repo-upkeep-bot";
export const BOT_EMAIL = "repo-upkeep-bot@users.noreply.github.com";

export interface Workspace {
  dir: string;
  repo: string;
}

export async function createWorkspace(repo: string): Promise<Workspace> {
  const dir = await mkdtemp(join(tmpdir(), "repo-upkeep-"));
  await cloneShallow(httpsCloneUrl(repo), dir);
  await configureIdentity(BOT_NAME, BOT_EMAIL, { cwd: dir });
  return { dir, repo };
}

export async function destroyWorkspace(ws: Workspace): Promise<void> {
  await rm(ws.dir, { recursive: true, force: true });
}
