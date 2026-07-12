import { describe, expect, it } from "vitest";
import { parseSelection } from "./prompt.js";
import {
  buildRepoEntries,
  defaultGitAuthor,
  defaultOnboardConfig,
  noreplyEmail,
  renderConfigYaml,
  renderReposYaml,
} from "./onboard/configWrite.js";
import { excludedOnboardingRepos, filterReposForOnboarding } from "./onboard/repos.js";
import { loadConfig } from "./config.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("parseSelection", () => {
  it("parses comma-separated indices", () => {
    expect(parseSelection("1,3,5", 5)).toEqual([0, 2, 4]);
  });

  it("parses ranges and all", () => {
    expect(parseSelection("2-4", 5)).toEqual([1, 2, 3]);
    expect(parseSelection("all", 3)).toEqual([0, 1, 2]);
  });

  it("rejects out-of-range values", () => {
    expect(parseSelection("0", 3)).toBeNull();
    expect(parseSelection("4", 3)).toBeNull();
    expect(parseSelection("3-1", 5)).toBeNull();
  });
});

describe("onboard repo filter", () => {
  it("keeps only repos owned by the user and drops installer artifacts", () => {
    const login = "ada";
    const repos = [
      { nameWithOwner: "ada/project", isPrivate: false, description: null, ownerLogin: "ada" },
      { nameWithOwner: "ada/my-daily-commit", isPrivate: true, description: null, ownerLogin: "ada" },
      { nameWithOwner: "HumfDev/daily-commit", isPrivate: false, description: null, ownerLogin: "HumfDev" },
      { nameWithOwner: "org/shared", isPrivate: false, description: null, ownerLogin: "org" },
    ];
    const filtered = filterReposForOnboarding(login, repos, "HumfDev/daily-commit");
    expect(filtered.map((r) => r.nameWithOwner)).toEqual(["ada/project"]);
    expect(excludedOnboardingRepos("ada", "HumfDev/daily-commit")).toEqual(
      new Set(["humfdev/daily-commit", "ada/my-daily-commit"]),
    );
  });
});

describe("onboard config writers", () => {
  it("builds noreply email and author defaults", () => {
    expect(noreplyEmail({ id: 42, login: "ada" })).toBe("42+ada@users.noreply.github.com");
    expect(defaultGitAuthor({ id: 1, login: "ada", name: "Ada Lovelace" })).toBe("Ada Lovelace");
    expect(defaultGitAuthor({ id: 1, login: "ada", name: null })).toBe("ada");
  });

  it("renders yaml that loadConfig accepts", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-onboard-"));
    const config = defaultOnboardConfig({
      gitAuthor: "Ada",
      gitEmail: "1+ada@users.noreply.github.com",
    });
    const repos = buildRepoEntries(["ada/project", "ada/other"]);

    const configPath = join(dir, "config.yml");
    const reposPath = join(dir, "repos.yml");
    writeFileSync(configPath, renderConfigYaml(config));
    writeFileSync(reposPath, renderReposYaml(repos));

    const loaded = loadConfig(configPath, reposPath);
    expect(loaded.global.gitAuthor).toBe("Ada");
    expect(loaded.global.gitEmail).toBe("1+ada@users.noreply.github.com");
    expect(loaded.repos.map((r) => r.repo)).toEqual(["ada/project", "ada/other"]);
    expect(loaded.repos[0]!.actions.commit).toBe(true);
  });
});
