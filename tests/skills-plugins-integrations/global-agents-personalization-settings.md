# Global AGENTS.md personalization settings

## Prerequisites / setup

- Run the app with an isolated temporary `CODEX_HOME`; prepare both a regular `AGENTS.md` and a file-symbolic-link variant.
- For the override check, add a non-empty `AGENTS.override.md` beside `AGENTS.md`.
- Test desktop light/dark themes and a 375×812 mobile viewport.

## Actions

1. Open the sidebar Settings popover and select `Personalization`.
2. Confirm the full settings route loads the exact `CODEX_HOME/AGENTS.md` content, file path, and UTF-8 byte count.
3. Change the instructions and save. Reload the route and confirm the content persists exactly.
4. Repeat with `AGENTS.md` implemented as a symbolic link; confirm the link remains a link and its target content changes.
5. Make `AGENTS.override.md` non-empty and confirm a precedence warning shows its path. Empty the override and confirm the warning disappears after reload.
6. Save an empty `AGENTS.md` and confirm it is accepted.
7. Enter more than 32 KiB and confirm a warning appears without blocking save.
8. Repeat the page in dark mode and at 375×812.

## Expected results

- The settings page is a real route and is reachable from the existing settings popover.
- Save is disabled while loading, unchanged, or already saving; success and failure are visibly reported.
- Existing `AGENTS.md` symbolic links are preserved, including the repository's skill-sync link.
- A non-empty `AGENTS.override.md` is reported as effective; saving still updates `AGENTS.md` without claiming immediate precedence.
- The page explains that updated instructions apply to new chats/runs, matching Codex instruction discovery timing.
- Light and dark surfaces have readable text, borders, focus state, warnings, and status messages.

## Rollback / cleanup

- Remove the isolated temporary `CODEX_HOME` after the test.
- Do not save test content into the real user `CODEX_HOME` during automated verification.
