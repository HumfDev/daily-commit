# Contributing & publishing daily-commit

This repo is both:

1. A **template / control-repo** users clone (GitHub Actions cron lives here)
2. An **npm CLI package** named `daily-commit` so anyone can run:

```bash
npx daily-commit
```

That mirrors how Python projects ship a global CLI via PyPI (`pipx install dcad`) — for Node, the equivalent is publishing to **npm**.

---

## One-time setup (already in the repo)

### 1. Turn the repo into an npm CLI package

- Package name: `daily-commit` in `package.json`
- CLI entry points in `package.json`:

```json
"bin": {
  "daily-commit": "./dist/index.js",
  "dc": "./dist/index.js"
}
```

`npx daily-commit` runs the package bin (which scaffolds + onboards). After install, `dc` is the short CLI.

### 2. Ship compiled JS in the package

`npm run build` compiles `src/` → `dist/`. Only `dist/` (plus README/LICENSE) is published — the installer then **clones this GitHub repo** for the full control-repo template.

### 3. Build / publish scripts

- `scripts/publish.sh` — build, test, `npm pack`, smoke-test; optional `--upload` to npm
- `scripts/test-install.sh` — installs the tarball in a temp prefix and checks `daily-commit help` / `dc help`

### 4. GitHub Actions publish workflow

`.github/workflows/publish.yml` builds and uploads to npm when you:

- publish a GitHub Release, or
- push a `v*` tag, or
- run the workflow manually (`workflow_dispatch`)

### 5. npm + GitHub secrets (one-time external setup)

1. Create an [npm](https://www.npmjs.com/) account
2. Claim the package name by publishing once (or create the package on npmjs.com)
3. Pick **one** auth method for CI:

**Option A — Access token (required for first publish)**

npm granular tokens often **cannot create a brand-new package** (403 Forbidden).
For CI, prefer a **classic Automation** token:

1. npmjs.com → Access Tokens → Generate New Token → **Automation**
2. GitHub repo → Settings → Secrets → Actions → `NPM_TOKEN` = that token

If you insist on granular: grant **Read and write** to packages, and allow
publishing **new packages** under your user. A read-only or package-scoped
token that doesn't include `daily-commit` yet will fail with 403.

**Option B — Trusted Publishing / OIDC (no long-lived token)**

- npmjs.com → package `daily-commit` → Settings → Trusted Publisher  
  - GitHub user/org: your user  
  - Repository: `daily-commit`  
  - Workflow filename: `publish.yml`
- You can omit `NPM_TOKEN`; the workflow already has `id-token: write`

---

## Per-release steps

1. Bump `"version"` in `package.json` (semver)
2. Update `CHANGELOG.md` if you keep one
3. Commit and push to `main`
4. Create a GitHub Release with tag `v0.1.0` (must match the version you intend to publish), **or** `git tag v0.1.0 && git push origin v0.1.0`
5. The **publish** workflow uploads to npm automatically

Or publish manually:

```bash
bash scripts/publish.sh                 # build + pack + smoke test only
NPM_TOKEN=… bash scripts/publish.sh --upload   # upload to npm
```

---

## What end users run (after it’s on npm)

```bash
npx daily-commit
# or with a custom folder:
npx daily-commit@latest -- my-daily-commit

cd daily-commit   # or your folder name
npx dc dry-run
```

Optional global CLI (after the control repo exists, or for the scaffolder):

```bash
npm install -g daily-commit
daily-commit          # scaffold
dc help               # same binary
```

---

## Before npm (or for local testing)

From this source checkout:

```bash
npm install
npm run build
node dist/index.js help
bash scripts/publish.sh          # pack + smoke test without uploading
```

Install from a local tarball:

```bash
bash scripts/publish.sh
npm install -g ./daily-commit-*.tgz
daily-commit help
```

Or run the scaffolder straight from GitHub (no npm publish needed):

```bash
npx github:HumfDev/daily-commit
```

---

**Short version:** Package the repo as `daily-commit` with `bin` → `dist/index.js`, add `scripts/publish.sh` + `publish.yml`, store `NPM_TOKEN` (or Trusted Publishing), bump the version, cut a GitHub Release — then users run `npx daily-commit` to download and onboard.
