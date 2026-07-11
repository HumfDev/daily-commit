import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneShallow, configureIdentity } from "./git.js";
import { httpsCloneUrl } from "./gh.js";

export interface GitIdentity {
  name: string;
  email: string;
}

export interface Workspace {
  dir: string;
  repo: string;
}

export async function createWorkspace(
  repo: string,
  identity: GitIdentity,
): Promise<Workspace> {
  const dir = await mkdtemp(join(tmpdir(), "daily-commit-"));
  await cloneShallow(httpsCloneUrl(repo), dir);
  await configureIdentity(identity.name, identity.email, { cwd: dir });
  return { dir, repo };
}

export async function destroyWorkspace(ws: Workspace): Promise<void> {
  await rm(ws.dir, { recursive: true, force: true });
}
