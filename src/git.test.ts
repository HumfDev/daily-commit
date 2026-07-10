import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addAll, changedFiles, commit, configureIdentity } from "./git.js";
import { run } from "./exec.js";

async function initRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "upkeep-git-test-"));
  await run("git", ["init", "-q", "-b", "main"], { cwd: dir });
  await configureIdentity("Test", "test@example.com", { cwd: dir });
  return dir;
}

describe("changedFiles", () => {
  it("reports the correct filename for a single modified tracked file (regression: leading-space trim bug)", async () => {
    const dir = await initRepo();
    writeFileSync(join(dir, "README.md"), "hello\n");
    await addAll({ cwd: dir });
    await commit("initial", { cwd: dir });

    // A modify shows as " M README.md" in porcelain output — the leading
    // space matters and must not be swallowed when it's the only line.
    writeFileSync(join(dir, "README.md"), "hello again\n");

    const files = await changedFiles({ cwd: dir });
    expect(files).toEqual(["README.md"]);
  });

  it("reports correct filenames alongside an untracked file", async () => {
    const dir = await initRepo();
    writeFileSync(join(dir, "README.md"), "hello\n");
    await addAll({ cwd: dir });
    await commit("initial", { cwd: dir });

    writeFileSync(join(dir, "README.md"), "hello again\n");
    writeFileSync(join(dir, "NEW.md"), "new file\n");

    const files = await changedFiles({ cwd: dir });
    expect(files.sort()).toEqual(["NEW.md", "README.md"]);
  });
});
