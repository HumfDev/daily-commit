#!/usr/bin/env node
/**
 * `dc` / `daily-commit` bin shim: prefers compiled dist/, falls back to tsx.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = join(root, "dist", "index.js");
const srcEntry = join(root, "src", "index.ts");
const forwarded = process.argv.slice(2);

let result;
if (existsSync(distEntry)) {
  result = spawnSync(process.execPath, [distEntry, ...forwarded], {
    stdio: "inherit",
    cwd: root,
  });
} else {
  const tsxCli = join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) {
    console.error("dc: run `npm install` (and optionally `npm run build`) first.");
    process.exit(1);
  }
  result = spawnSync(process.execPath, [tsxCli, srcEntry, ...forwarded], {
    stdio: "inherit",
    cwd: root,
  });
}

process.exit(result.status ?? 1);
