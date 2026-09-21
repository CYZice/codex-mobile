### Feature: Current-turn upstream response.model status

#### Prerequisites / setup
- Use a Codex app-server with Responses SSE and TRACE enabled only for `codex_api::sse::responses` in its child process.
- Use synthetic `response.created`/`response.completed` TRACE events for unit tests; optional end-to-end verification may use one deliberately requested ephemeral turn.
- Open an existing thread with a selected model; repeat in both light and dark themes on desktop and narrow/mobile widths.

#### Actions
1. Without a response report, inspect the bottom-right corner of the desktop conversation area (outside the composer).
2. Simulate `turn/started` for thread A, turn 1, followed by an SSE `response.created` event containing `response.model: gpt-5.6-terra` while exactly one turn is active.
3. Complete that response, then create a second response with model `gpt-5.6-sol`; check the latest model and count of distinct response IDs.
4. Run two turns concurrently; do not attribute an unscoped TRACE event to either thread. Switch to thread B and back to A, then start turn 2 in A.
5. Simulate a delayed report for turn 1, a `model/rerouted` without a response report, a selected-model change, and a WebSocket `ready` reconnect.
6. Check light/dark themes on desktop, then widths 375 × 812 and 768 × 1024; mobile should not show the status per product preference.
7. Inspect runtime diagnostics and persisted logs for raw `SSE event:`/`response.created` payloads; only the validated model identifier may be forwarded to the UI.

#### Expected results
- Without a response event, the line says `response.model not captured`; it never copies the selected model into the upstream field.
- A matching event shows the server-declared model. When multiple Responses requests occur in a turn, the UI shows the last report and distinct response count, not a claim that all requests used the same model.
- A reroute notification alone is labeled `Rerouted to ... (response.model not captured)` and is not presented as an SSE response.
- Concurrent turns remain unreported rather than guessing attribution; a new turn, model change, or reconnect invalidates stale reports.
- The status sits in the desktop conversation's bottom-right blank space, outside the composer; it is hidden on mobile.
- Only parsed model metadata enters the notification stream and runtime diagnostics; no additional model requests or proxy hops are initiated by the feature.

#### Rollback / cleanup
- Stop the isolated test server, remove synthetic event injection, and preserve the previous package as a rollback target. Do not leave full TRACE payloads or test model settings behind.
