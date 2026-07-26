### Feature: Windows Codex CLI resolution across app-server flows

#### Prerequisites

- Run on Windows 11 as the same user that normally runs `codexapp`.
- `Get-Command codex` and `codex --version` succeed in PowerShell. The npm shim may resolve as `codex.ps1`/`codex.cmd`.
- Use a free local test port and do not expose it through FRP.
- Do not print, copy, or inspect `auth.json` or any Token during this test.

#### Steps

1. Run the production build and `node dist-cli/index.js --help`.
2. Start `node dist-cli/index.js --port 4192 --no-open --no-tunnel --no-login`.
3. Open the local page and request the model list or a recent thread.
4. Confirm startup/RPC does not report `Codex CLI is not available` when PowerShell can already run `codex`.
5. From the account login flow, start login and confirm the Codex process opens the expected login flow; cancel without changing the active account if login is not part of the test.
6. If a disposable test account entry is available, trigger its refresh path and confirm the temporary app-server starts without a Windows command-not-found error.
7. Repeat with `CODEXUI_CODEX_COMMAND` set to an explicit valid `codex.exe` path, then restore the environment variable.

#### Expected Results

- Bare `codex` npm shims are probed through the Windows `cmd.exe` wrapper.
- The packaged fallback searches `vendor/x86_64-pc-windows-msvc/bin/codex.exe`.
- Main app-server, login, and temporary app-server paths use the same resolver/invocation logic.
- Auth or Provider failures, if any, are reported separately from CLI resolution failures.
- No sensitive authentication content appears in logs or browser responses.

#### Rollback/Cleanup

- Stop the isolated `4192` process.
- Restore or remove the temporary `CODEXUI_CODEX_COMMAND` value.
- Do not delete or reset `CODEX_HOME` as part of cleanup.
