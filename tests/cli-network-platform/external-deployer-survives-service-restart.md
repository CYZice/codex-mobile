# External deployer survives CodexApp service restart

## Prerequisites

- `C:\Users\Lenovo\CodexRemote\deploy-codexapp.ps1` and `launch-codexapp-deploy.ps1` were copied from `scripts\windows\`.
- `CodexApp Remote` is running on port 5900.
- A locally built `codexapp-<version>.tgz` exists outside the global npm module directory.

## Actions

1. Run `launch-codexapp-deploy.ps1` with the tarball path, expected version, and `-DryRun`.
2. Confirm it returns a deployment process ID and writes `state\last-deploy.json` with outcome `dry-run` without changing port 5900.
3. Run the launcher again without `-DryRun` for a versioned tarball.
4. Confirm the launcher returns before the worker stops `CodexApp Remote`.
5. Wait for the worker to finish, then inspect the state JSON and deployment log.

## Expected results

- The detached worker continues after the 5900 service is stopped.
- The installed `codexapp` package version equals the expected version.
- `CodexApp Remote` is running again, port 5900 listens, and authenticated `/` plus `/codex-api/thread-unread-state` return HTTP 200.
- If installation or health checks fail, the worker restores the backup tarball and reports `rolled-back` or `rollback-failed` in the state JSON.

## Cleanup

- Keep the timestamped rollback tarball until a later successful deployment has been verified.
- Do not delete deployment logs while diagnosing a failed update.
