### Feature: Explicit upstream-model reroute status

#### Prerequisites / setup
- Use a Codex app-server that supports the `model/rerouted` notification.
- Use a local synthetic notification in a unit test or test bridge; **do not request a model response** to test this UI.
- Open an existing thread with a selected model; repeat in both light and dark themes, desktop and narrow/mobile widths.

#### Actions
1. Without any reroute event, inspect the line below the composer.
2. Simulate `turn/started` for thread A, turn 1, followed by `model/rerouted` with `fromModel: gpt-6-astra` and `toModel: gpt-5.6-sol` for the same thread/turn.
3. Switch to thread B and back to A; then start turn 2 in A.
4. Simulate a delayed reroute for A/turn 1, then a reroute for A/turn 2. Complete turn 2 and send another delayed turn-1 event.
5. Change the selected model in A, and simulate a WebSocket `ready` event after a reconnect.
6. Check the browser's UI in light and dark themes at 375 × 812 and 768 × 1024, including long model IDs.

#### Expected results
- With no explicit reroute, the line reads `Selected <model> · Upstream not reported` (Chinese UI: `所选 <model> · 上游未报告`). It never copies the selected model into the upstream field.
- A matching event shows `Selected gpt-6-astra · ↪ Upstream reported gpt-5.6-sol` (Chinese: `所选 gpt-6-astra · ↪ 上游报告 gpt-5.6-sol`).
- Threads have isolated state; a new turn, changed model, or reconnect invalidates stale reports. Delayed older-turn events never overwrite the current turn.
- The status is legible in both themes and wraps long IDs without covering input controls. No extra Codex request, probe or polling is initiated.

#### Rollback / cleanup
- Remove any test-only synthetic event injection. Do not leave modified conversations or model settings behind.
