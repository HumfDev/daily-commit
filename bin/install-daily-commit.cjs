#!/usr/bin/env node
"use strict";
/**
 * CJS launcher for npx/npm bin (most reliable across npm versions).
 * Prefer compiled dist/; fall back to tsx for source checkouts.
 */
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = join(__dirname, "..");
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
    console.error("install-daily-commit: run npm install && npm run build first.");
    process.exit(1);
  }
  result = spawnSync(process.execPath, [tsxCli, srcEntry, ...forwarded], {
    stdio: "inherit",
    cwd: root,
  });
}

process.exit(result.status ?? 1);
