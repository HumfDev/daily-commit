# Contributing & publishing daily-commit

This repo is:

1. The **source** for the `daily-commit` npm CLI
2. A **local install template** users clone to their machine (cron runs here)

There is **no GitHub Actions** infrastructure — scheduling is local cron only.

---

## Architecture

- **`npx daily-commit`** — downloads, clones this repo locally, runs onboard
- **`config.yml` / `repos.yml`** — user config in their install folder
- **`scripts/install-cron.sh`** — adds a crontab entry (every 2h at :17)
- **`dc run`** — catch-up: ≥`minActionsPerRepoPerDay` success per selected repo, then optional bonus ticks
- **`.dc-state.json`** — local state (cooldowns, global + per-repo daily counts)

Auth: `gh auth login` or `GH_TOKEN` with write access to all target repos.

---

## Development

```bash
npm install
npm run build
npm test
npx dc dry-run
```

Pack / smoke-test without uploading:

```bash
bash scripts/publish.sh
```

---

## Publishing to npm

Manual publish (no CI workflow):

1. Bump `"version"` in `package.json`
2. Commit and push
3. Publish:

```bash
bash scripts/publish.sh                 # build + pack + smoke test
NPM_TOKEN=… bash scripts/publish.sh --upload
```

For CI publish you would need an external runner or re-add automation yourself —
this repo intentionally ships without GitHub Actions.

**npm token:** prefer a classic **Automation** token for first publish.

---

## What end users run

```bash
npx daily-commit
cd daily-commit
npx dc dry-run
bash scripts/install-cron.sh
```

Optional global CLI:

```bash
npm install -g daily-commit
daily-commit
```

---

## License

MIT
