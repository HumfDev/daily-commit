import { scanDiff } from "../detectors/diffScan.js";
import type { RepoEntry } from "../config.js";
import { listOpenPRs, prDiff, reviewPullRequest } from "../gh.js";
import { pick } from "../random.js";
import { reviewClean, reviewIntro, reviewOutro } from "../templates/text.js";

export interface ReviewOutcome {
  performed: boolean;
  reason?: string;
  prNumber?: number;
  dryRun?: boolean;
  body?: string;
}

/**
 * Reads a PR's diff via `gh pr diff` (no clone/checkout needed) and runs
 * purely mechanical checks (merge-conflict markers left in, obvious secret
 * patterns). Always posts as a COMMENT — never approves or requests
 * changes — since this has no real judgment about the change itself.
 */
export async function runReviewAction(
  repo: RepoEntry,
  dryRun = false,
): Promise<ReviewOutcome> {
  const openPRs = await listOpenPRs(repo.repo);
  if (openPRs.length === 0) {
    return { performed: false, reason: "no open PRs" };
  }

  const target = pick(openPRs);
  const diff = await prDiff(repo.repo, target.number);
  const findings = scanDiff(diff);

  const body =
    findings.length === 0
      ? `${reviewIntro()}\n\n${reviewClean()}\n\n${reviewOutro()}`
      : `${reviewIntro()}\n\n${findings
          .map((f) => `- **${f.check}** in \`${f.file}\`: \`${f.snippet}\``)
          .join("\n")}\n\n${reviewOutro()}`;

  if (dryRun) {
    return { performed: true, prNumber: target.number, dryRun: true, body };
  }

  await reviewPullRequest(repo.repo, target.number, { event: "COMMENT", body });

  return { performed: true, prNumber: target.number, body };
}
