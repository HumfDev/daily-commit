# daily-commit

Automated, **no-AI** daily maintenance for GitHub repos: safe commits, PR
reviews, pull requests, and issues — generated entirely by deterministic
`git`/`gh` CLI commands, linters, and templates. No LLM calls, no embedded
prompts, no model API keys, anywhere in this codebase.

## What it actually does

Once a day-ish (randomized — see below), for one repo you've listed in
[`repos.yml`](./repos.yml), it does exactly one of:

- **commit** — a small, safe, non-functional change (e.g. a changelog-style
  log entry, a `README.md` "last synced" marker), pushed straight to the
  default branch.
- **pull_request** — the same kind of safe change, opened as a PR instead of
  pushed directly.
- **review** — reads an open PR's diff (`gh pr diff`, no clone needed) and
  posts a comment-only review from purely mechanical checks (leftover merge
  conflict markers, obvious hardcoded secret patterns). Never approves or
  requests changes.
- **issue** — runs a deterministic detector (`git grep` TODO/FIXME sweep, or
  `npm outdated`) and opens a templated issue if it found something, unless
  one's already open.
- **noop** — nothing. This is intentional and happens most ticks; see
  "Looking organic" below.

**Nothing here changes the functionality of your repo.** Commits/PRs are
restricted to an explicit allowlist of file globs (`docs/**`, `*.md`,
`CHANGELOG.md`, `.github/**` by default) and, if you configure a
`verifyCommand` (e.g. your test suite), that command must pass before
anything is pushed.

## Why no AI

Every action is produced by shelling out to `git` and `gh` — literally
`src/git.ts` / `src/gh.ts`, thin wrappers around the CLIs — plus static
detectors (`git grep`, `npm outdated`, regex diff scans) and a pool of
pre-written text templates with random variable substitution. There is no
network call to a model provider anywhere in this repo. You can audit the
entire content-generation surface in `src/templates/` and `src/mutations.ts`.

## Looking organic, not robotic

- The workflow ticks every 2 hours, but `src/scheduler.ts` gates each tick
  behind `runProbability`, `quietHours`, and `maxActionsPerDay` from
  `config.yml` — so real activity lands at unpredictable times, not a fixed
  clock.
- `src/picker.ts` weighted-randomly picks which repo and which action type
  runs (including "noop"), respecting a per-action cooldown so the same repo
  doesn't get reviewed twice in a day.
- Every commit message / PR title & body / issue title & body / review
  comment is drawn from a randomized template pool in `src/templates/`.

## Setup

1. **Use this repo as your control repo.** Fork it, or use it as a template.
   This is the repo the workflow runs *in* — it acts on the repos you list
   below, which can be different repos (or this one).

2. **List target repos in `repos.yml`:**

   ```yaml
   repos:
     - repo: "your-username/your-project"
       actions:
         commit: true
         pull_request: true
         review: true
         issue: true
       safePaths: ["docs/**", "*.md", "CHANGELOG.md"]
       verifyCommand: "npm test --silent"
   ```

3. **Create a fine-grained GitHub PAT** with `contents`, `pull-requests`, and
   `issues` **write** access scoped to every repo listed in `repos.yml` (and
   to this control repo itself, if you want it to persist run history — see
   below). Add it as a repository secret named `UPKEEP_PAT`.

4. **Tune `config.yml`** if you want (probabilities, quiet hours, safe paths,
   cooldowns) — sane defaults are already in place.

5. **Push.** The included workflow (`.github/workflows/daily.yml`) starts
   ticking on its cron automatically. Trigger it manually any time from the
   Actions tab (`workflow_dispatch`), optionally with `dry_run: true`.

### Local dry run

```bash
npm install
npm run dry-run   # picks + generates content, never pushes or calls gh
```

## Config reference

- **`repos.yml`** — the list of repos this control repo may act on, with
  per-repo action toggles, `safePaths` override, and optional
  `verifyCommand`.
- **`config.yml`** — global scheduling/randomization knobs: `runProbability`,
  `quietHours`, `maxActionsPerDay`, `actionWeights`, default `safePaths`,
  `cooldownHours`.

## Safety model

1. **Allowlist** (`src/safety/allowlist.ts`) — every changed file must match
   a configured glob, or the action aborts before staging anything.
2. **Verify gate** (`src/safety/verify.ts`) — if a repo defines
   `verifyCommand`, it's run in the clone and must exit 0 before anything is
   pushed.
3. **Mechanical only** — the review action never approves/blocks a PR, only
   comments; the issue action never edits code, only opens tracked issues
   with a `housekeeping` label.

## State

`.upkeep-state.json` in this control repo tracks the last run time per
repo+action and today's action count, so `maxActionsPerDay` and
`cooldownHours` are enforced across ticks. It's committed back automatically
using the workflow's default `GITHUB_TOKEN` (`contents: write` permission).

## Future work

- GitHub App auth as an alternative to a PAT, for easier multi-repo installs.
- More detectors (stale branches, missing test coverage, license header
  checks).
- Language-specific outdated-dependency detectors beyond `npm` (`pip-audit`,
  `cargo outdated`, etc.).

## License

MIT — see [LICENSE](./LICENSE).
