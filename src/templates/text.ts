import { pick } from "../random.js";

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const COMMIT_MESSAGES = [
  "chore: refresh changelog entry for {{date}}",
  "docs: small housekeeping pass on {{date}}",
  "chore: touch up docs formatting",
  "docs: update last-synced timestamp",
  "chore: routine doc maintenance",
  "docs: minor wording pass",
];

export const PR_TITLES = [
  "Routine doc/changelog housekeeping",
  "Small docs maintenance pass",
  "Changelog & doc touch-up",
  "Housekeeping: docs refresh",
];

export const PR_BODY_OPENERS = [
  "Small non-functional housekeeping pass — docs/changelog only, no logic changes.",
  "Routine maintenance: keeps docs and changelog current. No behavior change.",
  "Just tidying up docs/metadata. Nothing in application logic is touched.",
];

export const PR_BODY_CLOSERS = [
  "Safe to review whenever convenient.",
  "Low-risk, happy to have this merged at your leisure.",
  "No rush — batching this with routine upkeep.",
];

export function commitMessage(): string {
  return render(pick(COMMIT_MESSAGES), { date: today() });
}

export function prTitle(): string {
  return pick(PR_TITLES);
}

export function prBody(details: string): string {
  return `${pick(PR_BODY_OPENERS)}\n\n${details}\n\n${pick(PR_BODY_CLOSERS)}`;
}

export const REVIEW_INTROS = [
  "Ran the usual automated checks on this PR — here's what came back:",
  "Automated review pass (lint/static analysis only, no manual read):",
  "Sharing the results of the standard automated checks for this PR:",
];

export const REVIEW_CLEAN = [
  "No issues found by any of the configured checks. 👍",
  "Everything came back clean — nothing flagged.",
  "All automated checks passed without findings.",
];

export const REVIEW_OUTROS = [
  "This is a mechanical check, not a substitute for human review of the actual change.",
  "Automated only — please still have a human take a look before merging.",
  "Purely tool-generated; a maintainer should still review the substance of the change.",
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

export const ISSUE_INTROS = [
  "Automated housekeeping scan found the following:",
  "Routine repo scan turned up this:",
  "Flagging this from the scheduled maintenance scan:",
];

export function issueIntro(): string {
  return pick(ISSUE_INTROS);
}
