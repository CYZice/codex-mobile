### GPT-5.6 Max and Ultra thinking levels

#### Feature/Change Name
GPT-5.6 reasoning-level selection supports the new `max` and `ultra` values.

#### Prerequisites/Setup
1. Install a Codex CLI version whose model catalog includes GPT-5.6 and its new reasoning levels.
2. Sign in with an account that can use a GPT-5.6 model.
3. Build and start the app.

#### Steps
1. Start a new chat and select `GPT-5.6-Sol` or `GPT-5.6-Terra`.
2. Open the Thinking selector in light theme and confirm `Max` and `Ultra` are present.
3. Select `Max`, send a prompt, and confirm the turn starts without an invalid reasoning-effort error.
4. Select `Ultra`, send a second prompt, and confirm the turn starts without an invalid reasoning-effort error.
5. Select `GPT-5.6-Luna` and confirm `Max` is present but `Ultra` is absent.
6. Select `GPT-5.5` and confirm both `Max` and `Ultra` are absent.
7. Select a custom-provider model whose catalog has no reasoning metadata and confirm both `Max` and `Ultra` are absent.
8. Switch from a GPT-5.6 model with `Ultra` selected to GPT-5.5 and confirm Thinking changes to GPT-5.5's default effort.
9. Switch to dark theme and repeat the selector visibility checks.
10. With `Ultra` selected in one existing thread, switch to another thread, choose a different supported level, then switch back and confirm the first thread still displays `Ultra`.
11. Reload the page on the first thread and confirm the selector still displays the reasoning effort reported by the resumed thread.

#### Expected Results
- The Thinking selector follows each model's `supportedReasoningEfforts` metadata.
- GPT-5.6 Sol and Terra include `Max` and `Ultra`; GPT-5.6 Luna includes `Max` only; GPT-5.5 includes neither.
- Models without advertised reasoning metadata retain the legacy levels through `Extra high` and do not expose `Max` or `Ultra`.
- Selecting either value passes the exact lowercase `max` or `ultra` value to Codex.
- Switching to a model that does not support the current effort selects that model's default effort.
- A configured `max` or `ultra` value survives config normalization and appears selected after refresh.
- Each thread restores its own thinking level after thread switches and page reloads instead of being overwritten by the global model configuration refresh.
- The options remain readable in light and dark themes.

#### Rollback/Cleanup
- Restore the preferred model and thinking level.

---
