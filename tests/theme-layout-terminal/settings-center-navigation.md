# Settings center navigation

## Prerequisites / setup

- Start Codex Mobile with a configured account and at least one archived chat.

## Actions

1. Click the sidebar `Settings` entry.
2. Confirm the page opens at `#/settings/general` and the settings navigation is visible.
3. Select Appearance, Input, Voice, Configuration, Archived chats, Personalization, and Accounts & limits.
4. Confirm every selection scrolls to its corresponding settings group and the browser URL reflects the selected section.
5. Confirm Telegram is not visible anywhere in the settings UI.
6. Open a thread and confirm the sidebar no longer displays context-token text; the composer context ring remains available on desktop.

## Expected results

- Existing controls retain their previous values and save behavior after the move from the sidebar popover.
- Personalization continues to edit global `AGENTS.md` from the settings center.
- Archived chats can be loaded and restored from the dedicated section.
- Telegram bridge configuration is not exposed through the UI.

## Rollback / cleanup

- Restore any archived chat used for the check.
