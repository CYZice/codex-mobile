# Official model catalog picker

## Prerequisites / setup

- Run a current Codex app-server with an authenticated OpenAI/Codex provider.
- Start Codex Mobile from the current checkout.
- Ensure the official `model/list` response contains at least one current model and, when available, one superseded model with an `upgrade` target.

## Actions

1. Call `POST /codex-api/rpc` with `model/list`, `limit: 100`, and `includeHidden: false` and note the returned order, `displayName`, `hidden`, `isDefault`, `upgrade`, and `nextCursor` fields.
2. Open a new chat and expand the model picker.
3. Confirm the visible picker follows the official catalog order and uses `displayName` rather than formatting the model id locally.
4. Confirm entries marked `hidden: true` do not appear.
5. Confirm entries with a non-empty `upgrade` target do not appear in the normal picker when they are not the current configured/selected model.
6. Configure or restore a chat that is already using a superseded model and reload.
7. Confirm that currently used superseded model remains selectable for that chat/configuration instead of disappearing mid-session.
8. If `nextCursor` is returned, confirm Codex Mobile requests the next page and appends unique visible models without changing the server-provided order.
9. Switch to a provider-backed model source such as OpenCode Zen and confirm provider-owned model order remains unchanged by the official Codex filtering rules.

## Expected results

- New official models appear automatically as soon as they are returned by `model/list`; no GPT-version regex update is required.
- Hidden catalog entries remain hidden.
- Superseded entries with `upgrade` are omitted unless they are retained because the current chat/configuration is already using them.
- The official `isDefault` model is preferred when Codex Mobile needs a fallback selection.
- Reasoning-effort metadata remains model-specific.
- Pagination is bounded to `limit: 100` per request and stops when `nextCursor` is null or repeats.
- Provider-backed model sources are not reordered or filtered by Codex-specific upgrade metadata.

## Rollback / cleanup

- Restore any temporary model/config selection changed during the test.
