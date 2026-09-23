# Settings center navigation

## Prerequisites / setup

- Start Codex Mobile with a configured account and at least one archived chat.

## Actions

1. Click the sidebar `Settings` entry.
2. Confirm the page opens at `#/settings/general` and the settings navigation is visible.
3. Select Agent, Appearance, Voice, Personalization, Activity, Data, and Accounts & limits.
4. Confirm every selection opens only that category and the browser URL reflects the selected section.
5. In Agent, switch between User config and Project config, change one reversible value, and confirm the custom model dropdown and explanatory rows save to the displayed `config.toml` path.
6. In Activity, confirm totals load from local Codex history; if the old web host is running, confirm the page explains that Codex Mobile must be restarted.
7. In Data, confirm archived chat management is presented as its own page and archived chats can be loaded, restored, and paged.
8. On a non-settings route, click the sidebar Settings button and confirm the quick menu shows the active account, usage, `Reload app-server`, and `Settings`.
9. In Appearance, confirm System, Light, and Dark are selectable and the Absolutely theme preview uses the supplied accent color.
10. Confirm Telegram is not visible anywhere in the settings UI.
11. Open a thread and confirm the sidebar no longer displays context-token text; the composer context ring remains available on desktop.
12. At a 375x812 viewport, confirm Settings keeps a left vertical category list and a right scrollable content pane; the category list must not become a horizontal tab strip and the page must not overflow horizontally.
13. At a 768x1024 viewport, confirm the same left-list/right-content structure remains in place.
14. Repeat the narrow-layout checks in both Light and Dark appearance modes and confirm the navigation border, active row, content surface, and controls use the matching theme without light-surface leaks in Dark mode.

## Expected results

- Existing controls retain their previous values and save behavior after the move from the sidebar popover.
- Personalization continues to edit global `AGENTS.md` from the settings center.
- User config writes `~/.codex/config.toml`; Project config writes the active project's `.codex/config.toml` and is unavailable without a project cwd.
- Activity performs one bounded aggregate request and does not read transcript bodies; Data owns archived chat management.
- Archived chats can be loaded and restored from the dedicated Data page.
- The quick settings menu provides app-server reload and usage access without opening the full settings route.
- Appearance persists the selected System/Light/Dark mode and applies the supplied `codex-theme-v1` Light/Dark palette.
- Telegram bridge configuration is not exposed through the UI.
- Desktop, tablet, and phone layouts all use the same left-side vertical settings navigation; narrow layouts reduce the rail width and hide the section-name search field instead of switching to horizontal tabs.
- The Settings page has no horizontal document overflow at 375x812 or 768x1024.

## Rollback / cleanup

- Restore any archived chat used for the check.
