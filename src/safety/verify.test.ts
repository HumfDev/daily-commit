import { describe, expect, it } from "vitest";
import { runVerifyCommand } from "./verify.js";

describe("runVerifyCommand", () => {
  it("passes when no verifyCommand is configured", async () => {
    const result = await runVerifyCommand(undefined, process.cwd());
    expect(result.ok).toBe(true);
  });

  it("passes when the command exits 0", async () => {
    const result = await runVerifyCommand("true", process.cwd());
    expect(result.ok).toBe(true);
  });

  it("fails and aborts when the command exits non-zero — the second safety gate", async () => {
    const result = await runVerifyCommand("false", process.cwd());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("exited");
  });
});
