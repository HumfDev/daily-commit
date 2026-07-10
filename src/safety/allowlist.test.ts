import { describe, expect, it } from "vitest";
import { checkAllowlist, isAllowed } from "./allowlist.js";

describe("isAllowed", () => {
  it("matches simple root-level globs", () => {
    expect(isAllowed("README.md", ["*.md"])).toBe(true);
    expect(isAllowed("docs/guide.md", ["*.md"])).toBe(false);
  });

  it("matches recursive globs", () => {
    expect(isAllowed("docs/a/b/guide.md", ["docs/**"])).toBe(true);
    expect(isAllowed("src/index.ts", ["docs/**"])).toBe(false);
  });
});

describe("checkAllowlist", () => {
  const safePaths = ["docs/**", "*.md", "CHANGELOG.md"];

  it("passes when every changed file matches a safe path", () => {
    const result = checkAllowlist(["README.md", "docs/x.md"], safePaths);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks when any changed file falls outside the allowlist — this is the core safety guarantee", () => {
    const result = checkAllowlist(["README.md", "src/app.ts"], safePaths);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(["src/app.ts"]);
  });

  it("blocks on an empty safe path list (nothing is allowed by default)", () => {
    const result = checkAllowlist(["README.md"], []);
    expect(result.ok).toBe(false);
  });
});
