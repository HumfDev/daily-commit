# daily-commit

Local cron bot that makes small, safe commits / PRs / reviews / issues across
**your** GitHub repos every day — **no AI**, **no GitHub Actions**, no separate
control repo.

CLI: **`daily-commit`** / **`dc`** (use `npx dc` from the install folder —
bare `dc` is macOS’s calculator).

## Install

```bash
npx daily-commit@latest
```

Optional folder name:

```bash
npx daily-commit@latest -- my-daily-commit
```

That will:

1. Clone this template into a local folder
2. Install deps and build
3. Run interactive onboard (`gh` login, pick **repos you own**, write config)
4. Optionally install local cron

Then test:

```bash
cd ~/daily-commit          # or the folder you chose
npx dc dry-run             # no remote writes
npx dc run                 # live: catch-up every under-served repo
```

From anywhere (uses the npm package entrypoint):

```bash
npx daily-commit dry-run
npx daily-commit run
```

## What it does

For each selected repo in local `repos.yml`, it can:

| Action | Behavior |
|--------|----------|
| **commit** | Safe docs/meta change, push to default branch |
| **pull_request** | Same kind of change on a branch + open a PR |
| **review** | Comment-only mechanical check on an open PR (never approve/request changes) |
| **issue** | Open a housekeeping issue from `git grep` TODO/FIXME or `npm outdated` |
| **noop** | Do nothing (bonus ticks only — not during daily catch-up) |

Mutations are boring on purpose: append to `docs/DAILY_COMMIT_LOG.md`, or refresh
a `<!-- dc:last-synced: DATE -->` marker in `README.md`. Commit/PR messages name
the file that actually changed.

**Nothing here is meant to change app behavior.** Changed files must match
`safePaths` (default: `docs/**`, `*.md`, `CHANGELOG.md`, `.github/**`). Optional
per-repo `verifyCommand` must pass before push.

### Daily catch-up (not “one random repo”)

Cron (or `npx dc run`) runs **catch-up**: every selected repo that still has
fewer than `minActionsPerRepoPerDay` successful actions **today** gets attempts
until one succeeds (commit/PR preferred). After all repos meet the minimum,
later ticks may do a single bonus action using `runProbability` / weights.

Your machine must be **on and awake** for cron to fire. Sleeping/lid-closed
ticks are skipped (organic gaps).

## Schedule

Onboard can install cron, or:

```bash
bash scripts/install-cron.sh
bash scripts/uninstall-cron.sh
```

Default: every **2 hours at :17**. Logs: `daily-commit.log` in the install
folder. Inspect with `crontab -l`.

Auth for cron: `GH_TOKEN=$(gh auth token)` — stay logged into GitHub CLI.

## Config (local only)

`dc onboard` writes **gitignored** `config.yml` + `repos.yml`. Examples:

- [`config.example.yml`](./config.example.yml)
- [`repos.example.yml`](./repos.example.yml)

Useful knobs:

| Key | Meaning |
|-----|---------|
| `minActionsPerRepoPerDay` | Guarantee ≥N successful actions per selected repo per day (default `1`) |
| `maxActionsPerDay` | Cap on total successes after minimums are met |
| `runProbability` | Chance a bonus tick runs after mins are met |
| `quietHours` | UTC hours with no activity |
| `cooldownHours` | Per repo+action cooldown (ignored during catch-up) |
| `actionWeights` | Relative odds for commit / PR / review / issue / noop |
| `safePaths` | Glob allowlist for commit/PR file changes |
| `gitAuthor` / `gitEmail` | Commit identity (use your GitHub noreply email) |

Onboard lists **repos you own** only (excludes this installer template and a
legacy `my-daily-commit` control repo). No “add another owner’s repo” prompt.

## Auth

- Prefer `gh auth login`
- Or set `GH_TOKEN` / `GITHUB_TOKEN`
- Needs write on **contents**, **pull-requests**, and **issues** for every
  target in `repos.yml`

## CI/CD note

Doc commits/PRs can still **trigger** workflows that listen to every `push` /
`pull_request`. To avoid noise, path-filter CI in target repos so `*.md` /
`docs/**` don’t start builds, and consider removing `.github/**` from
`safePaths` so this tool can’t edit Actions configs.

## Safety

1. **Allowlist** — non-matching files abort before stage/push  
2. **Verify gate** — optional `verifyCommand` in the clone must exit 0  
3. **Reviews** — comments only  
4. **Issues** — open only; stable titles so duplicates are skipped  

## State

Local `.dc-state.json` tracks last run per `repo:action`, global daily counts,
and **per-repo** daily successes. Not pushed to GitHub.

## Develop / publish

See [CONTRIBUTING.md](./CONTRIBUTING.md). Manual npm publish (no Actions in
this repo):

```bash
npm test && npm run build
bash scripts/publish.sh --upload   # needs NPM_TOKEN or npm login
```

## License

MIT — see [LICENSE](./LICENSE).
