import type { GhRepoListItem } from "../gh.js";

const DEFAULT_TEMPLATE = process.env.DC_REPO ?? "HumfDev/daily-commit";

/** Repos excluded from onboarding targets (installer source, legacy control repo). */
export function excludedOnboardingRepos(login: string, templateRepo = DEFAULT_TEMPLATE): Set<string> {
  return new Set([
    templateRepo.toLowerCase(),
    `${login}/my-daily-commit`.toLowerCase(),
  ]);
}

/**
 * Only repos the authenticated user owns, minus installer/control artifacts.
 * Does not include org repos or collaborations under other owners.
 */
export function filterReposForOnboarding(
  login: string,
  repos: GhRepoListItem[],
  templateRepo = DEFAULT_TEMPLATE,
): GhRepoListItem[] {
  const exclude = excludedOnboardingRepos(login, templateRepo);
  const owner = login.toLowerCase();
  return repos.filter((r) => {
    const [repoOwner] = r.nameWithOwner.split("/");
    if (!repoOwner || repoOwner.toLowerCase() !== owner) return false;
    return !exclude.has(r.nameWithOwner.toLowerCase());
  });
}
