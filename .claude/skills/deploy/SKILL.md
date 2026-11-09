---
name: deploy
description: Deploy PU Connect to its production VPS with the scripts in deploy/ (per component - db, api, web, admin, docs, nginx - or all), monitor the release, verify health, and roll back the web slot. Use when asked to deploy, release, ship, verify, or roll back production.
---

# PU Connect Deployment

Deploy with the scripts in `deploy/` (repository root). Read `deploy/README.md` for the command table; treat the scripts as the source of truth. Infrastructure context: `docs/diagrams/06-deployment.md`.

## Choose the component

Deploy only what changed. Every command syncs the working tree, takes the VPS deploy lock, then does its own part.

| Changed | Run |
| --- | --- |
| `apps/web` | `pnpm run deploy:web` |
| `apps/api`, no new SQL | `pnpm run deploy:api` |
| new `*.sql` migration | `pnpm run deploy:db`, then `deploy:api` if the code uses it |
| `apps/admin` | `pnpm run deploy:admin` |
| `apps/docs` or `docs/` | `pnpm run deploy:docs` |
| `packages/schemas` | `deploy:api`, `deploy:web`, `deploy:admin` |
| several areas, or unsure | `pnpm run deploy:vps` (all, in order: db, api, admin, docs, nginx, web, verify; `--skip db,docs` skips parts) |

Also: `deploy:nginx` (Nginx only), `deploy:verify` and `deploy:status` (read-only), `deploy:rollback` (web only).

## Scope and preparation

- An explicit request to deploy authorizes running the scripts. Reuse authorization already given for the current release; do not ask again without a concrete scope change.
- Deploy ships the **working directory**, including uncommitted and untracked files, through `rsync --delete`; it does not deploy a Git commit. Each command prints how many uncommitted changes it is shipping. Read `git status --short` first, tell the user which unrelated WIP goes along, and if that exceeds the authorization, deploy from an isolated copy of `HEAD` instead. Never stash, discard, or overwrite someone else's work.
- Deploying does not require committing or pushing. Do those only when requested or already authorized.
- Finish required documentation for the change. New migration: add the file name at the END of `deploy/migrations.list` and to `apps/api/test/global-setup.ts`, run `pnpm docs:erd`, keep the file idempotent. Never add `psql` lines to `scripts/deploy.sh` (it is now only a wrapper around `deploy/all.sh`).
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm build` for the parts you changed, unless equivalent checks already passed for the current source. Do not run Next.js build and typecheck concurrently (false TS6053 failures). Fix failures the release introduced; report unrelated warnings accurately.

## Execute and monitor

Run one command at a time from the repository root. For long runs (web takes 3 to 8 minutes on the 2 GB VPS) send output to a unique temporary log and run in the background, keep the exit status, and inspect the log; a successful `tee` or `tail` is not proof of success.

```bash
pnpm run deploy:web > "$SCRATCH/deploy-web.log" 2>&1; echo "EXIT=$?" >> "$SCRATCH/deploy-web.log"
```

Give a short progress note at least once per minute. Never print `.env`, credentials, tokens, or session cookies.

What the scripts guarantee (do not re-implement by hand):

- **One deploy at a time.** The VPS lock (`/var/lock/pu-deploy.lock`, tied to the SSH session) makes a second deploy stop with who/when/what holds it. If you see that message, wait; do not delete the lock or start another build. `pnpm run deploy:status` shows whether a deploy is running.
- **Migrations stop on error.** `deploy:db` runs every file in `deploy/migrations.list` with `ON_ERROR_STOP`; a failing file stops the deploy and leaves API and Web untouched. `MIGRATIONS_STRICT=0` continues past errors; use it only when the error is known to be harmless and the user agreed. Destructive migrations (DROP, DELETE, TRUNCATE) need the user's confirmation first.
- **API:** builds sequentially, smoke-loads the compiled app module before restart, then waits for `/api/auth/me` to answer 401.
- **Web blue/green:** builds into the idle `.next-a`/`.next-b` slot, records the old slot in `.web-slot.env.prev`, switches, waits for HTTP 200/3xx, and goes back to the old slot by itself if the new one does not answer. `.next-cache` is shared; old static chunks are kept 7 days. Never build over the live slot.
- Builds run sequentially at reduced CPU/IO priority because the VPS has little memory.

## Verify the release

`pnpm run deploy:verify` (also run by `deploy:vps` and `deploy:rollback`) must pass:

| Check | Expected |
| --- | --- |
| `https://puc.vnhat.dev/` | 200 |
| `https://admin-puc.vnhat.dev/` | 200 |
| `https://docs-puc.vnhat.dev/` | 200 |
| `https://puc.vnhat.dev/api/auth/me` and the same path on the admin host, no session | 401 |
| `pu-api`, `pu-web` | active |
| `nginx -t` | ok |

For a UI release, also open the affected route in an authenticated browser session when feasible, and say whether it was checked visually or only by HTTP status.

## Failure handling

- Find the failed phase in the log, then inspect bounded remote logs, for example `ssh root@103.195.237.112 'journalctl -u pu-web -n 60 --no-pager'` (same for `pu-api`). Redact sensitive output.
- Do not rerun the same command repeatedly without a diagnosis. A Web build failure before the switch leaves the old Web serving; migrations and uploaded files may already have changed, so do not call it a full rollback.
- **Lock held / BUSY:** another deploy is running (often another session on the shared worktree). Wait and retry; do not run a manual `next build` on the VPS, because it writes into the same slot and breaks both builds.
- Web broken after a switch: `pnpm run deploy:rollback` restores the recorded previous slot (web only; it does not undo API, DB, Admin, or Nginx). Never guess the slot.
- Stop and report a concrete blocker when recovery needs new credentials, a destructive database operation, broader infrastructure changes, or an unresolved authorization decision. Do not restore production data or change secrets as an automatic retry.

## Completion report

State which component(s) were deployed, the URLs, the verify results, and any limitation. Say whether the UI was checked visually, and whether Git was committed or pushed. Do not claim deployment when only a local build passed.

Keep this file identical to `.agents/skills/deploy/SKILL.md` whenever updating the workflow.
