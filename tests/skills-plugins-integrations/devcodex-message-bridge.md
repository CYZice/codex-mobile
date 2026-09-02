### Feature: DevCodex bridge exposes native thread and turn control

#### Prerequisites
- Build and start Codex Mobile on a fixed loopback port, for example `--host 127.0.0.1 --port 5900 --strict-port`.
- Start the matching DevCodex build with `DEVSPACE_CODEX_MOBILE_URL=http://127.0.0.1:5900`.
- Open Codex Mobile in a browser and prepare one idle disposable thread plus one long-running disposable turn.
- Connect an MCP client to DevCodex with `codex_list_threads`, `codex_read_thread`, `codex_dispatch`, `codex_turn_status`, and `codex_interrupt`.

#### Steps
1. Call `codex_list_threads` without a cwd and confirm the browser threads are returned. Repeat with an exact cwd and confirm unrelated threads are absent.
2. Call `codex_read_thread` for one returned ID and confirm recent user and assistant messages match the browser without reasoning or internal tool events.
3. Call `codex_dispatch` with `target.type: new`, an authorized cwd, and `mode: start`. Confirm a real native thread and first `turnId` are returned and appear in the browser.
4. On an idle existing thread, call `codex_dispatch` with `target.type: thread` and `mode: start`. Confirm it starts immediately.
5. While that thread is active, repeat `mode: start` and confirm `THREAD_BUSY`; verify the prompt was not queued.
6. While the turn remains active, call `mode: queue`. Confirm `state: queued`, the existing Codex Mobile queue displays the message, and it starts in order after the active turn completes.
7. Start another long turn and call `mode: steer`. Confirm the input is appended to that exact active turn. Repeat on an idle thread and confirm `NO_ACTIVE_TURN`; verify it does not start or queue a message.
8. Call `codex_turn_status` with the active `turnId`, then without a turn ID. Confirm factual `running`, `waiting_approval`, `queued`, `completed`, `failed`, or `interrupted` state matches Codex Mobile.
9. Call `codex_interrupt` with the exact active `threadId` and `turnId`. Confirm the turn stops. Repeat with a completed or unrelated turn and confirm `TURN_NOT_ACTIVE` or `TURN_NOT_FOUND`.
10. Stop Codex Mobile and call a bridge tool. Confirm DevCodex reports `CODEX_MOBILE_UNAVAILABLE` and does not start another App Server.

#### Expected Results
- New threads use native `thread/start`, and message execution uses the existing native turn-start path.
- Existing-thread `start`, `queue`, and `steer` remain distinct and never silently fall back to one another.
- Queue data, permission presets, collaboration mode, approvals, and execution state remain owned by Codex Mobile.
- Status and interrupt operations use real thread and turn IDs rather than DevCodex-local task records.
- No autonomous supervisor, polling loop, auto-continue, auto-steer, or auto-approval behavior is introduced.
- Only one Codex App Server process exists throughout the test.

#### Performance Audit
- Thread listing performs one native `thread/list` call and no per-thread reads.
- Thread reading performs one native `thread/read` call and bounded message sanitization.
- Status performs one native `thread/read` plus one local queue-state read; it does not poll.
- Dispatch performs only the native read/start/steer operation required by the selected explicit mode and reuses the existing queue processor.
- Interrupt performs one verification read followed by one native `turn/interrupt` call.

#### Rollback/Cleanup
- Let or delete disposable queued messages.
- Remove disposable threads if they are no longer needed.
- Restart Codex Mobile and DevCodex with their normal settings.
