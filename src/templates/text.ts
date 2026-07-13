import { pick } from "../random.js";

export type MutationKind = "log" | "readme-marker";

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Short conventional commits that name the file that actually changed. */
const COMMIT_BY_KIND: Record<MutationKind, string[]> = {
  log: [
    "docs: append {{date}} entry to {{file}}",
    "chore: note {{date}} in {{file}}",
    "docs: {{file}} check-in",
    "chore: update {{file}}",
  ],
  "readme-marker": [
    "docs: sync last-synced marker in {{file}}",
    "chore: refresh {{file}} sync stamp",
    "docs: bump last-synced in {{file}}",
    "chore: touch {{file}} marker",
  ],
};

/**
 * Commit message tied to the mutation that ran — not a generic
 * "changelog housekeeping" line when we only touched a log or README marker.
 */
export function commitMessage(kind: MutationKind, filePath: string): string {
  return render(pick(COMMIT_BY_KIND[kind]), { date: today(), file: filePath });
}

const PR_TITLE_BY_KIND: Record<MutationKind, string[]> = {
  log: [
    "docs: daily commit log entry",
    `Append entry to docs log`,
    "chore: housekeeping log update",
  ],
  "readme-marker": [
    "docs: refresh README sync marker",
    "chore: update last-synced stamp",
    "docs: README last-synced",
  ],
};

export function prTitle(kind: MutationKind, filePath: string): string {
  // Occasionally use the file path as the whole title (short / informal).
  if (Math.random() < 0.25) {
    return `Update ${filePath}`;
  }
  return pick(PR_TITLE_BY_KIND[kind]);
}

type BodyStyle = "minimal" | "plain" | "formal";

const BODY_STYLES: BodyStyle[] = ["minimal", "plain", "formal"];

/**
 * PR body varies in length/formality. Always names the changed file.
 */
export function prBody(kind: MutationKind, filePath: string): string {
  const style = pick(BODY_STYLES);
  const what =
    kind === "log"
      ? `Appended a dated line to \`${filePath}\`.`
      : `Refreshed the last-synced marker in \`${filePath}\`.`;

  if (style === "minimal") {
    return what;
  }
  if (style === "plain") {
    return `${what}\n\nDocs/metadata only — no code changes.`;
  }
  return [
    what,
    "",
    "Non-functional housekeeping so the file stays current.",
    "Safe to merge whenever.",
  ].join("\n");
}

const REVIEW_INTROS = [
  "Automated checks on this PR:",
  "Quick mechanical scan (no judgment on the design):",
  "Static checks only:",
];

const REVIEW_CLEAN = [
  "Nothing flagged.",
  "No matches for conflict markers or obvious secret patterns.",
  "Configured checks came back empty.",
];

const REVIEW_OUTROS = [
  "Mechanical only — still needs a human look.",
  "Not a substitute for reviewing the actual change.",
  "Tool-generated; please review substance before merging.",
];

export function reviewIntro(): string {
  return pick(REVIEW_INTROS);
}

export function reviewClean(): string {
  return pick(REVIEW_CLEAN);
}

export function reviewOutro(): string {
  return pick(REVIEW_OUTROS);
}

/** Build a full review comment; clean path stays short more often. */
export function reviewBody(findingsText: string | null): string {
  if (!findingsText) {
    // ~half the time: one short line, no disclaimer block
    if (Math.random() < 0.5) {
      return reviewClean();
    }
    return `${reviewIntro()}\n\n${reviewClean()}\n\n${reviewOutro()}`;
  }
  return `${reviewIntro()}\n\n${findingsText}\n\n${reviewOutro()}`;
}

const ISSUE_INTROS = [
  "Scan result:",
  "From a scheduled repo scan:",
  "Flagging for awareness:",
];

export function issueIntro(): string {
  return pick(ISSUE_INTROS);
}
