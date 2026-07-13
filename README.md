# daily-commit

Automated, **no-AI** daily maintenance for GitHub repos: safe commits, PR
reviews, pull requests, and issues — generated entirely by deterministic
`git`/`gh` CLI commands, linters, and templates. No LLM calls, no embedded
prompts, no model API keys, anywhere in this codebase.

CLI: **`dc`** (short for daily commit).

Runs on **your machine** via local cron (like [commit-bot](https://github.com/theshteves/commit-bot)) — no GitHub Actions, no per-user control repo.

## What it actually does

Once a day-ish (randomized — see below), for one repo you've listed in
`repos.yml` (created by `dc onboard`), it does exactly one of:

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

- Cron ticks every 2 hours. Each `dc run` **catch-up** walks every selected
  repo that still needs today's minimum (`minActionsPerRepoPerDay`, default 1)
  and keeps trying actions until one succeeds (commit/PR preferred). Extra
  bonus ticks after all repos are covered still use `runProbability` / noop.
- If your laptop is off at cron time, that tick is skipped (same idea as
  commit-bot — gaps look natural).
- Every commit message / PR title & body / issue title & body / review
  comment is drawn from a randomized template pool in `src/templates/`.

## Quick start (one command)

```bash
npx daily-commit
```

Optional directory name:

```bash
npx daily-commit@latest -- my-daily-commit
```

Or from GitHub directly (no npm publish needed):

```bash
npx github:HumfDev/daily-commit
```

That downloads the project, installs dependencies, runs onboarding, and
optionally installs local cron.

Then:

```bash
cd daily-commit   # or the directory name you chose
npx dc dry-run
```

(Use `npx dc` — bare `dc` is macOS’s calculator.)

Publishing this package to npm: see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Setup

1. **Install** via `npx daily-commit` (or clone this repo and run `npx dc onboard`).

2. **Onboard** (`dc onboard`) writes `config.yml` + `repos.yml`:
   - GitHub account → `gitAuthor` / `gitEmail` (commits attribute to you)
   - Multi-select your repos (or type `owner/name`)
   - Optional: install cron (`scripts/install-cron.sh`)

3. **Authenticate** with GitHub CLI (`gh auth login`) or set `GH_TOKEN`.
   The token needs `contents`, `pull-requests`, and `issues` **write** on
   every repo in `repos.yml`.

4. **Schedule** local cron (onboarding offers this, or run manually):

```bash
bash scripts/install-cron.sh
```

Default schedule: every 2 hours at `:17`. Logs go to `daily-commit.log` in
your install folder.

Remove cron:

```bash
bash scripts/uninstall-cron.sh
```

### Manual run

```bash
npx dc dry-run   # safe — no remote writes
npx dc run       # live tick
```

## Config reference

- **`config.example.yml` / `repos.example.yml`** — reference templates (copy or use `dc onboard` to generate `config.yml` / `repos.yml` locally; those files are gitignored).

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

`.dc-state.json` in your install directory tracks the last run time per
repo+action and today's action count (`maxActionsPerDay`, `cooldownHours`).
It stays local — not committed to GitHub.

## Future work

- GitHub App auth as an alternative to a PAT, for easier multi-repo installs.
- More detectors (stale branches, missing test coverage, license header
  checks).
- Language-specific outdated-dependency detectors beyond `npm` (`pip-audit`,
  `cargo outdated`, etc.).

## License

MIT — see [LICENSE](./LICENSE).
