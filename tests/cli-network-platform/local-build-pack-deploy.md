# Local build, pack, and deploy

## Prerequisites

- Windows with Node.js and npm available.
- The local `codexapp` fork is checked out with dependencies installed.
- DevCodex Desktop is installed at `D:\DevCodex Desktop` and is currently managing Codex Mobile.
- `components\codex-mobile\node_modules\codexapp` is the active managed Codex Mobile installation.

## Dry-run verification

1. Run `npm run deploy:local:dry-run` from the repository root.
2. Confirm unit tests, frontend build, CLI build, and `npm pack` all succeed.
3. Confirm the tarball is written under `output/local-release/<version>/`.
4. Confirm deployment validation succeeds without stopping the running service.

Expected result: the command exits successfully, reports the package version from `package.json`, validates the managed DevCodex Desktop component, and leaves the running Codex Mobile process unchanged.

## Full deployment

1. Run `npm run deploy:local` from the repository root.
2. Confirm the packed tgz is copied into `D:\DevCodex Desktop\packages` and the component package metadata is backed up.
3. Confirm `components\codex-mobile\package.json` and `package-lock.json` point to the new local tgz.
4. Confirm `component-manifest.json` reports the new Codex Mobile version.
5. Confirm the managed Codex Mobile child process restarts with a new PID and `http://127.0.0.1:5900/healthz` returns HTTP 200.
6. Read `components\codex-mobile\node_modules\codexapp\package.json` and confirm its version matches the repository version.

Expected result: one command builds, packs, installs into the DevCodex Desktop managed component, restarts Codex Mobile, and verifies the local fork. If deployment fails after backup, the deploy script restores the previous managed package metadata and installation.

## Optional fast iteration

Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/windows/build-pack-deploy.ps1 -SkipTests` only when the relevant tests were already run separately in the same development cycle.
