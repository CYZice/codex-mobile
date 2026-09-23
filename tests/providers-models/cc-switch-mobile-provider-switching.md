# CC Switch mobile provider switching

## Prerequisites

- Windows with CC Switch v3.20.1 database schema 18.
- At least one official Codex provider and one compatible third-party provider in CC Switch.
- CC Switch proxy takeover disabled.
- No Codex turn or approval request is active.
- Record the original provider and the SHA-256 hash of `~/.codex/auth.json`.

## Switch from mobile web

1. Open CodexMobile on a phone-sized viewport and expand Settings.
2. Confirm the CC Switch provider row shows the same current provider as CC Switch desktop.
3. Open the provider menu and select a different compatible provider.
4. Wait for the switching state to clear.
5. Start a new thread and confirm its model request uses the selected provider.

Expected results:

- The provider row updates without exposing an API key or full endpoint configuration.
- Providers with a CC Switch `modelCatalog` (such as DeepSeek V4) remain selectable when their generated Codex configuration is safely projectable.
- `~/.codex/config.toml` contains the selected provider projection.
- CC Switch desktop and `settings.json.currentProviderCodex` show the selected provider.
- Exactly one Codex runtime reload occurs and existing threads remain visible.
- The SHA-256 hash of `~/.codex/auth.json` is unchanged.

## Third-party Codex tool metadata fallback

1. Select a third-party CC Switch provider whose active model has no Codex model-catalog entry, or temporarily remove only that model entry from a disposable catalog fixture.
2. Switch to that provider from CodexMobile. Repeat the same-provider switch once after it is already current.
3. Inspect the `model_catalog_json` referenced by the projected `~/.codex/config.toml`.
4. Repeat with an existing third-party model entry whose provider capabilities include a custom context window, image/search flags, or other provider-specific fields.
5. Force a runtime reload failure in a fixture and inspect the catalog afterward.

Expected results:

- A missing third-party model entry is created from CC Switch `modelCatalog` identity/context/reasoning data when available, with a local official Codex model used only as the schema template.
- The repaired entry uses `shell_type: unified_exec`, `apply_patch_tool_type: freeform`, `multi_agent_version: v2`, parallel tool calls, skills/apps/plugins usage instructions, and an enabled Node REPL.
- Existing provider-owned fields such as context window, image capability, search capability, and custom metadata survive unchanged.
- Hosted/provider capabilities are not fabricated: search remains disabled when the provider metadata does not advertise it, Responses Lite remains disabled for synthesized third-party entries, and `tool_mode` is not forced to GPT code mode.
- Re-selecting the current third-party provider still performs the repair and reload rather than silently no-oping.
- If runtime reload fails, both the projected config and model catalog return to their exact previous contents; a newly-created fallback catalog is removed.
- After repair, a coding turn can use both shell execution and `apply_patch` without `Unknown model ... fallback model metadata` or `unsupported call: apply_patch` errors.

## External CC Switch synchronization and stale-state protection

1. Leave CodexMobile open with the current provider visible.
2. Switch the Codex provider from the CC Switch desktop application without refreshing CodexMobile.
3. Keep the page visible for at least one polling interval, then start a new thread.

Expected results:

- CodexMobile updates its provider row and model list without a browser refresh.
- The Codex app-server reloads after the external provider change; no CodexMobile restart is required.
- If a Codex turn is active, the provider change remains pending until the turn is idle and does not interrupt the active turn.
- If CodexMobile submits a switch using an outdated provider state, the request is rejected without changing `config.toml`, `settings.json`, or the CC Switch database, then the UI refreshes to the actual provider.

## Packaged CLI built-in module loading

1. Build the CLI with `pnpm run build:cli`.
2. Confirm `dist-cli/index.js` does not contain `import("sqlite")`.
3. Start the packaged CLI with the same Node executable used by CodexDesktop on a disposable port.
4. Request `/codex-api/cc-switch/status` from that packaged server.

Expected results:

- The packaged CLI loads Node's built-in `node:sqlite` implementation rather than looking for an npm package named `sqlite`.
- The status endpoint returns JSON with `available: true`, schema version 18, and the redacted CC Switch provider list.
- The test does not change the current provider or `~/.codex/auth.json`.

## Safety refusals

1. Start a Codex turn and try another provider switch.
2. Resolve or finish the turn, enable CC Switch proxy takeover, and try again.
3. Restore the supported schema and direct mode after observing each refusal.

Expected results:

- An active turn or approval produces a visible busy error and does not change config or CC Switch state.
- Proxy takeover produces a visible unsupported-state error and does not change config or CC Switch state.
- Unknown CC Switch schemas remain readable as an unavailable status and are never written.

## Themes and responsive layout

1. Inspect Settings at 375x812 and 768x1024 in light mode.
2. Repeat in dark mode.

Expected results:

- Provider names truncate instead of overlapping the label or menu chevron.
- Endpoint/model metadata stays inside the settings panel.
- Dropdown, switching state, and error surfaces have readable contrast in both themes.

## Settings quick menu, message refresh, and response.model

1. Open a thread, open the Settings quick menu, navigate to the Settings route, then click the Settings button again.
2. Confirm the quick menu still opens on the Settings route.
3. Use the Provider control in the quick menu to select another compatible CC Switch provider, then wait for switching to finish.
4. Return to the thread and use Refresh messages from the quick menu.
5. Run a Responses turn and inspect the status row below the composer.

Expected results:

- The right-side Summary panel and its show-summary button are not displayed.
- The Settings quick menu can be opened both on a thread route and on the Settings route.
- The quick menu Provider control uses the same CC Switch provider list and switch behavior as the Account settings control.
- Refresh messages reloads only the selected thread's messages and shows a busy state while the request is active.
- When the bridge receives an explicit upstream `response.model`, the status row displays `Server response.model <model>`; it does not substitute the selected/requested model.

Cleanup:

Restore the original provider after the check and leave the thread idle.

## Cleanup

Switch back to the recorded original provider and confirm the original auth hash remains unchanged. Disable any proxy takeover enabled for the refusal test.
