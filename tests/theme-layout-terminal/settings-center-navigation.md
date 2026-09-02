# Settings center navigation

## Prerequisites / setup

- Start Codex Mobile with a configured account and at least one archived chat.

## Actions

1. Click the sidebar `Settings` entry.
2. Confirm the page opens at `#/settings/general` and the settings navigation is visible.
3. Select Agent, Appearance, Voice, Personalization, Data & activity, and Accounts & limits.
4. Confirm every selection opens only that category and the browser URL reflects the selected section.
5. In Agent, switch between User config and Project config, change one reversible value, save, reload, and confirm it was written to the displayed `config.toml` path.
6. In Data & activity, confirm totals load from local Codex history and archived chat management remains available.
5. Confirm Telegram is not visible anywhere in the settings UI.
6. Open a thread and confirm the sidebar no longer displays context-token text; the composer context ring remains available on desktop.

## Expected results

- Existing controls retain their previous values and save behavior after the move from the sidebar popover.
- Personalization continues to edit global `AGENTS.md` from the settings center.
- User config writes `~/.codex/config.toml`; Project config writes the active project's `.codex/config.toml` and is unavailable without a project cwd.
- Activity performs one bounded aggregate request and does not read transcript bodies.
- Archived chats can be loaded and restored from Data & activity.
- Telegram bridge configuration is not exposed through the UI.

## Rollback / cleanup

- Restore any archived chat used for the check.
