import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, safePathsFor } from "./config.js";

function writeTmp(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "dc-config-test-"));
  const path = join(dir, name);
  writeFileSync(path, contents, "utf8");
  return path;
}

describe("loadConfig", () => {
  it("parses valid config.yml + repos.yml", () => {
    const configPath = writeTmp(
      "config.yml",
      [
        "runProbability: 0.5",
        "quietHours: [0, 1]",
        "maxActionsPerDay: 3",
        "safePaths: ['docs/**']",
        'gitAuthor: "Ada Lovelace"',
        'gitEmail: "ada@users.noreply.github.com"',
        "",
      ].join("\n"),
    );
    const reposPath = writeTmp(
      "repos.yml",
      'repos:\n  - repo: "owner/name"\n    actions:\n      commit: true\n',
    );

    const { global, repos } = loadConfig(configPath, reposPath);
    expect(global.runProbability).toBe(0.5);
    expect(global.maxActionsPerDay).toBe(3);
    expect(global.gitAuthor).toBe("Ada Lovelace");
    expect(global.gitEmail).toBe("ada@users.noreply.github.com");
    expect(repos).toHaveLength(1);
    expect(repos[0]!.repo).toBe("owner/name");
    expect(repos[0]!.actions.commit).toBe(true);
    // Unspecified action flags default to true per the schema.
    expect(repos[0]!.actions.review).toBe(true);
  });

  it("rejects config missing gitAuthor/gitEmail", () => {
    const configPath = writeTmp("config.yml", "safePaths: ['docs/**']\n");
    const reposPath = writeTmp("repos.yml", 'repos:\n  - repo: "owner/name"\n');

    expect(() => loadConfig(configPath, reposPath)).toThrow();
  });

  it("rejects a repo entry that isn't 'owner/name'", () => {
    const configPath = writeTmp(
      "config.yml",
      "safePaths: ['docs/**']\ngitAuthor: 'A'\ngitEmail: 'a@example.com'\n",
    );
    const reposPath = writeTmp("repos.yml", 'repos:\n  - repo: "not-a-valid-repo"\n');

    expect(() => loadConfig(configPath, reposPath)).toThrow();
  });

  it("rejects an empty repos list", () => {
    const configPath = writeTmp(
      "config.yml",
      "safePaths: ['docs/**']\ngitAuthor: 'A'\ngitEmail: 'a@example.com'\n",
    );
    const reposPath = writeTmp("repos.yml", "repos: []\n");

    expect(() => loadConfig(configPath, reposPath)).toThrow();
  });
});

describe("safePathsFor", () => {
  it("uses the repo's own safePaths when set", () => {
    const global = {
      runProbability: 0.5,
      quietHours: [],
      maxActionsPerDay: 1,
      actionWeights: { commit: 1, pull_request: 1, review: 1, issue: 1, noop: 1 },
      safePaths: ["docs/**"],
      cooldownHours: 20,
      gitAuthor: "Test User",
      gitEmail: "test@users.noreply.github.com",
    };
    const repo = {
      repo: "owner/name",
      actions: { commit: true, pull_request: true, review: true, issue: true },
      safePaths: ["custom/**"],
    };
    expect(safePathsFor(repo, global)).toEqual(["custom/**"]);
  });

  it("falls back to the global safePaths otherwise", () => {
    const global = {
      runProbability: 0.5,
      quietHours: [],
      maxActionsPerDay: 1,
      actionWeights: { commit: 1, pull_request: 1, review: 1, issue: 1, noop: 1 },
      safePaths: ["docs/**"],
      cooldownHours: 20,
      gitAuthor: "Test User",
      gitEmail: "test@users.noreply.github.com",
    };
    const repo = {
      repo: "owner/name",
      actions: { commit: true, pull_request: true, review: true, issue: true },
    };
    expect(safePathsFor(repo, global)).toEqual(["docs/**"]);
  });
});
