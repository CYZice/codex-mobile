### Codex Desktop style sidebar

#### Feature/Change Name
Desktop navigation uses a compact Codex-style neutral hierarchy without changing available destinations.

#### Prerequisites/Setup
1. Run the app at `http://127.0.0.1:4173`.
2. Have multiple projects and threads, including an active and unread thread.

#### Steps
1. Open the desktop UI at `1440x1000` in Light mode.
2. Inspect the Codex header, new-thread row, Skills/Automations rows, Projects heading, project rows, nested thread rows, active state, timestamps, and hover menus.
3. Repeat in Dark mode.
4. Resize the sidebar and collapse/reopen it.
5. Open the mobile drawer at `375x812` and confirm its existing navigation behavior remains intact.

#### Expected Results
- Existing destinations are unchanged; no placeholder navigation is added.
- Top-level actions and project/thread rows use compact neutral list styling.
- Active and hover states use subtle gray surfaces rather than colorful cards.
- Text, icons, unread state, and menus remain readable in both themes.
- Resizing, collapsing, project expansion, thread selection, and mobile drawer behavior still work.

#### Rollback/Cleanup
- Restore the previous sidebar width and theme if changed during the test.

