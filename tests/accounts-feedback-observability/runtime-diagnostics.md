# Runtime diagnostics

## Prerequisites / setup

- Start Codex Mobile with the normal local development or packaged command.
- Confirm the selected CODEX_HOME is writable.

## Actions

1. Open Settings > Activity and confirm Runtime diagnostics loads with lifecycle, counters, WebSocket clients, and recent events.
2. Use Reload app-server, then refresh Activity.
3. Start a turn that fails, and confirm the latest failure appears without prompt text, paths, tokens, or attachment contents.
4. Disconnect/reconnect the browser transport and confirm WebSocket reconnect or SSE fallback events appear.
5. Generate enough runtime events to cross the 1 MiB threshold and inspect CODEX_HOME/codex-mobile/diagnostics/ for runtime.jsonl plus at most four backups.
6. Check Activity in light and dark themes, then use Copy summary and confirm it matches the sanitized diagnostics response.

## Expected results

- Diagnostics remain bounded, readable, and local-only.
- Chat traffic continues if log persistence fails.
- The endpoint is read-only and uses the existing authenticated route.

## Cleanup / rollback

- Remove the diagnostics directory under the selected CODEX_HOME after testing if the logs are no longer needed.
