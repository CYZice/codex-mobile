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
- `~/.codex/config.toml` contains the selected provider projection.
- CC Switch desktop and `settings.json.currentProviderCodex` show the selected provider.
- Exactly one Codex runtime reload occurs and existing threads remain visible.
- The SHA-256 hash of `~/.codex/auth.json` is unchanged.

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

## Cleanup

Switch back to the recorded original provider and confirm the original auth hash remains unchanged. Disable any proxy takeover enabled for the refusal test.
