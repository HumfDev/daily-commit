import { describe, expect, it } from "vitest";
import { scanDiff } from "./diffScan.js";

describe("scanDiff", () => {
  it("flags leftover merge conflict markers in added lines", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,3 +1,7 @@",
      " const x = 1;",
      "+<<<<<<< HEAD",
      "+const y = 2;",
      "+=======",
      "+const y = 3;",
      "+>>>>>>> feature",
    ].join("\n");

    const findings = scanDiff(diff);
    const checks = findings.map((f) => f.check);
    expect(checks).toContain("merge-conflict-marker");
  });

  it("flags obvious secret patterns", () => {
    const diff = [
      "diff --git a/config.ts b/config.ts",
      "--- a/config.ts",
      "+++ b/config.ts",
      "@@ -1 +1 @@",
      "+const key = 'AKIAABCDEFGHIJKLMNOP';",
    ].join("\n");

    const findings = scanDiff(diff);
    expect(findings.some((f) => f.check.includes("AWS Access Key"))).toBe(true);
    // Secret value itself must never appear verbatim in the report.
    expect(findings.every((f) => f.snippet === "[redacted]")).toBe(true);
  });

  it("ignores removed lines and context lines", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,2 +1,2 @@",
      "-<<<<<<< stale",
      " const x = 1;",
      "+const y = 2;",
    ].join("\n");

    expect(scanDiff(diff)).toEqual([]);
  });

  it("returns no findings for a clean diff", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "+const x = 1;",
    ].join("\n");

    expect(scanDiff(diff)).toEqual([]);
  });
});
