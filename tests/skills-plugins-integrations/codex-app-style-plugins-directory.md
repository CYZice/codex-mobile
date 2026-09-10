### Codex.app-style Plugins Directory

#### Feature/Change Name
The skills route presents four first-class sections: Plugins, Apps, MCP, and Skills. MCP servers are managed in their own tab and are no longer embedded in Skills.

#### Prerequisites/Setup
1. Dev server running at http://127.0.0.1:4173
2. Codex CLI available in PATH
3. Optional: a Codex CLI version with plugin/list, app/list, and mcpServerStatus/list app-server APIs

#### Steps
1. Open http://127.0.0.1:4173/#/skills
2. Verify the page title is Skills & Apps and the tab row contains Plugins, Apps, MCP, and Skills
3. Switch tabs and verify the URL query uses tab=plugins, tab=apps, tab=mcp, or tab=skills
4. On Plugins, verify only installed plugins are shown by default, including disabled installed plugins, and search/sorting/details/enable-disable actions remain available.
5. Open the browser network panel, reload the Plugins tab, and verify loading the installed plugin list does not issue `app/list` requests.
6. Open a plugin with no associated Apps and verify its detail opens without issuing `app/list`; open a plugin that declares Apps and verify Apps are loaded only when needed for that detail.
7. Switch to Apps and verify the app catalog loads there and existing cards, search, sorting, and enable/disable actions remain available.
8. Switch to MCP and verify configured servers show auth status, tool/resource counts, and expandable details.
9. Click Refresh while on MCP and verify the MCP configuration reloads before statuses are listed again.
10. Verify unavailable or empty MCP APIs produce an isolated state without breaking other tabs.
11. Verify Skills only contains installed skill discovery and management; it has no embedded MCP section.
12. Verify light and dark themes keep tabs, MCP cards, and Skills rows readable.

#### Expected Results
- The four directory tabs render without a full-page error.
- Plugins loads `plugin/list` without coupling first paint to the paginated Apps catalog, and the default list contains installed plugins only.
- A thread change while Plugins is active does not trigger `app/list`.
- Plugin details only load the Apps catalog when the selected plugin actually declares Apps.
- Plugin, app, MCP, and Skills failures remain isolated to their own surface.
- MCP uses app-server status, reload, and OAuth methods; no Composio catalog or installer is shown.
- MCP refresh performs one reload followed by one status listing.

#### Rollback/Cleanup
- Re-enable any app or plugin disabled during testing.
- Uninstall any plugin installed only for this test.
