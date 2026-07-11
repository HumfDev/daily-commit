import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pick } from "./random.js";
import { today } from "./templates/text.js";

export interface Mutation {
  filePath: string;
  description: string;
}

const LOG_BLURBS = [
  "Routine housekeeping check-in — nothing to report.",
  "Scheduled maintenance sweep completed.",
  "Docs housekeeping pass.",
  "Daily commit check-in.",
];

/**
 * Always-safe mutation: appends a timestamped line to a log file this tool
 * owns outright, under docs/**. Doesn't depend on any file existing in the
 * target repo already, so it never fails to find something to touch.
 */
async function appendDailyCommitLog(repoDir: string): Promise<Mutation> {
  const relPath = "docs/DAILY_COMMIT_LOG.md";
  const absPath = join(repoDir, relPath);
  await mkdir(dirname(absPath), { recursive: true });

  let existing = "";
  try {
    existing = await readFile(absPath, "utf8");
  } catch {
    existing = "# Daily Commit Log\n\nAutomated, non-functional housekeeping entries.\n\n";
  }

  const line = `- ${today()}: ${pick(LOG_BLURBS)}\n`;
  await writeFile(absPath, existing + line, "utf8");

  return { filePath: relPath, description: "Appended an entry to docs/DAILY_COMMIT_LOG.md." };
}

/**
 * Best-effort mutation: refreshes a `<!-- dc:last-synced: DATE -->`
 * marker comment in README.md. Only touches the marker line (adds one if
 * absent) — never restructures existing content.
 */
async function refreshReadmeMarker(repoDir: string): Promise<Mutation | null> {
  const relPath = "README.md";
  const absPath = join(repoDir, relPath);
  let content: string;
  try {
    content = await readFile(absPath, "utf8");
  } catch {
    return null;
  }

  const marker = `<!-- dc:last-synced: ${today()} -->`;
  const markerRe = /<!-- (?:dc|upkeep):last-synced: [\d-]+ -->/;

  const next = markerRe.test(content)
    ? content.replace(markerRe, marker)
    : `${marker}\n${content}`;

  if (next === content) return null;

  await writeFile(absPath, next, "utf8");
  return { filePath: relPath, description: "Refreshed the last-synced marker in README.md." };
}

async function readmeExists(repoDir: string): Promise<boolean> {
  try {
    await readFile(join(repoDir, "README.md"), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks exactly one mutation to apply — never both — so each run produces a
 * single small, easy-to-review diff rather than touching every candidate
 * file every time.
 */
export async function applyRandomMutation(repoDir: string): Promise<Mutation> {
  const generators: Array<(dir: string) => Promise<Mutation | null>> = [appendDailyCommitLog];
  if (await readmeExists(repoDir)) {
    generators.push(refreshReadmeMarker);
  }

  const generator = pick(generators);
  const result = await generator(repoDir);
  return result ?? appendDailyCommitLog(repoDir);
}
