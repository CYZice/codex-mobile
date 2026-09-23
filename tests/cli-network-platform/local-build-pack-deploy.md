# Local build, pack, and deploy

## Prerequisites

- Windows with Node.js and npm available.
- The local `codexapp` fork is checked out with dependencies installed.
- `CodexApp Remote` is installed as the scheduled task used by `scripts/windows/deploy-codexapp.ps1`.
- The currently installed global `codexapp` package exists at the path expected by the deploy script.

## Dry-run verification

1. Run `npm run deploy:local:dry-run` from the repository root.
2. Confirm unit tests, frontend build, CLI build, and `npm pack` all succeed.
3. Confirm the tarball is written under `output/local-release/<version>/`.
4. Confirm deployment validation succeeds without stopping the running service.

Expected result: the command exits successfully, reports the package version from `package.json`, and leaves the running CodexApp service unchanged.

## Full deployment

1. Run `npm run deploy:local` from the repository root.
2. Confirm the current installed package is backed up before replacement.
3. Confirm the scheduled task restarts and port `5900` returns to listening state.
4. Confirm the root page and `/codex-api/thread-unread-state` health checks succeed.
5. Read the globally installed `codexapp/package.json` and confirm its version matches the repository version.

Expected result: one command builds, packs, deploys, restarts, and verifies the local fork. If deployment fails after backup, the existing deploy script restores the previous package.

## Optional fast iteration

Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/windows/build-pack-deploy.ps1 -SkipTests` only when the relevant tests were already run separately in the same development cycle.
