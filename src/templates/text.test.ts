import { describe, expect, it } from "vitest";
import {
  commitMessage,
  prBody,
  prTitle,
  reviewBody,
  reviewClean,
} from "./text.js";

describe("commitMessage", () => {
  it("names the log file for log mutations", () => {
    const msg = commitMessage("log", "docs/DAILY_COMMIT_LOG.md");
    expect(msg).toContain("docs/DAILY_COMMIT_LOG.md");
    expect(msg.toLowerCase()).not.toMatch(/changelog/);
  });

  it("names README for marker mutations", () => {
    const msg = commitMessage("readme-marker", "README.md");
    expect(msg).toContain("README.md");
  });
});

describe("prTitle / prBody", () => {
  it("body always mentions the changed file", () => {
    const body = prBody("log", "docs/DAILY_COMMIT_LOG.md");
    expect(body).toContain("docs/DAILY_COMMIT_LOG.md");
  });

  it("title is short and file- or kind-related", () => {
    const title = prTitle("readme-marker", "README.md");
    expect(title.length).toBeLessThan(80);
    expect(title.toLowerCase()).toMatch(/readme|sync|last-synced|update/i);
  });
});

describe("reviewBody", () => {
  it("never uses emoji in clean copy", () => {
    for (let i = 0; i < 20; i++) {
      expect(reviewClean()).not.toMatch(/👍|✅|🎉/);
      expect(reviewBody(null)).not.toMatch(/👍|✅|🎉/);
    }
  });

  it("includes findings when present", () => {
    const body = reviewBody("- **secret** in `a.ts`: `sk-test`");
    expect(body).toContain("secret");
    expect(body).toContain("a.ts");
  });
});
