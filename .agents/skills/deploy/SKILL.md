---
name: deploy
description: Deploy PU Connector to its production VPS using scripts/deploy.sh, monitor the release, and verify Web, Admin, and API health. Use when the user requests deployment, release, or running the deploy script; creating or editing this skill does not authorize deployment.
---

# PU Connector Deployment

Use the existing `scripts/deploy.sh` from the repository root. Treat its current contents as the source of truth. Read `docs/diagrams/06-deployment.md` for infrastructure context when needed.

## Scope and preparation

- An explicit request to deploy authorizes running the script. Reuse authorization already given for the current release; do not ask for confirmation again without a concrete scope change.
- Read the script and `git status --short` before execution. It deploys the **working directory**, including uncommitted and untracked files, through `rsync --delete`; it does not deploy a Git commit.
- Check whether unrelated local changes would be included. Explain the actual deployment scope. If it exceeds the user's authorization, prepare an isolated copy containing the authorized changes or clarify the scope before uploading. Never stash, discard, or overwrite someone else's work to make deployment possible.
- Deploying does not require committing or pushing. Do those only when requested or already authorized.
- Complete required documentation updates for the changes being released. For new migrations, follow the project's local migration and ERD workflow and verify that the deploy script includes the migration.
- Run `pnpm build`, then `pnpm typecheck` and `pnpm lint` before deployment, unless equivalent checks already passed for the current source. Do not run Next.js build and typecheck concurrently: build rewrites `.next/types` and can cause false TS6053 failures.
- Fix failures introduced by the release. Report unrelated existing failures or warnings accurately; do not claim a clean lint run when warnings remain.

## Execute and monitor

Run one deployment at a time from the repository root:

```bash
pnpm run deploy:vps
```

This invokes `bash scripts/deploy.sh`. Either command is acceptable. For a long-running tool session, redirect output to a unique temporary log, retain the process/session ID, and inspect the log while waiting. Preserve the deployment command's exit status; a successful `tee` or `tail` is not proof of deployment success.

Give concise progress updates at least once per minute. Report the current phase and any actual failure without dumping migration notices or full logs. Never print environment files, credentials, tokens, or session cookies.

The current script performs:

1. SSH connectivity check to `root@103.195.237.112`.
2. Working-directory sync into `/var/www/pu-connector`, preserving the configured exclusions such as `.env`, dependencies, build slots, and credential JSON files. Inspect exclusions rather than assuming all secret filenames are covered.
3. PostgreSQL/Redis startup and SQL migrations, with conditional initial seeding.
4. Dependency installation, sequential API/Admin builds, and an API module-load smoke check; then a Web build into the inactive `.next-a` or `.next-b` slot.
5. Web slot switch, restart of `pu-api` and `pu-web`, Nginx configuration validation and reload.
6. Public HTTP health checks.

Preserve the Web slot mechanism: `.web-slot.env` selects the active build; `.next-cache` is shared; previous static chunks are retained for seven days. Do not build over the live Web slot or delete it. VPS builds are deliberately sequential and use reduced CPU/I/O priority because memory is limited. Local checks matter because the remote Web build sets `NEXT_SKIP_CHECKS=1`.

## Verify the release

Require both process completion and the expected health results:

| Check | Expected result |
| --- | --- |
| `https://puc.vnhat.dev/` | HTTP 200 |
| `https://admin-puc.vnhat.dev/` | HTTP 200 |
| `https://puc.vnhat.dev/api/auth/me` without a session | HTTP 401 |
| `pu-api`, `pu-web` | Both systemd services active |
| `nginx -t` | Configuration valid |

The script's final success banner checks only the Web status. Inspect Admin and API results independently; do not treat the banner alone as success. If results are missing or unexpected, rerun targeted read-only checks with `curl` and SSH. For a UI release, inspect the affected route in an available authenticated browser session when feasible; distinguish HTTP health from visual verification.

## Failure handling

- Identify the failed phase and inspect bounded logs, for example `journalctl -u pu-web -n 60 --no-pager` or the equivalent for `pu-api` over SSH. Redact sensitive output.
- Do not repeatedly rerun the entire script without diagnosing the cause. SQL errors can appear even when `psql` exits successfully because the script does not enable `ON_ERROR_STOP`; inspect migration output for errors as well.
- A Web build failure before the slot switch normally leaves the old Web process serving its build. Migrations and uploaded files may already have changed; do not describe the deployment as fully rolled back.
- If the new Web slot fails after switching, and rollback is within the authorized recovery scope, restore the **recorded previous slot** in `.web-slot.env`, restart `pu-web`, and verify health. Never guess the previous slot. This restores only the Web build, not API binaries, database changes, Admin files, or Nginx configuration.
- Stop and report a concrete blocker when recovery requires new credentials, destructive database operations, broader infrastructure changes, or an unresolved authorization decision. Do not restore production data or change secrets as an automatic retry.

## Completion report

State the deployed URL, health results, and any remaining limitation. Say whether the affected UI was visually checked, and whether Git was committed/pushed if relevant. Do not claim deployment when only a local build passed.

Keep this file identical to `.claude/skills/deploy/SKILL.md` whenever updating the workflow.
