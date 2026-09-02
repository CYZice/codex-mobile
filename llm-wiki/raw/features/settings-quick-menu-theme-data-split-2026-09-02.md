# Settings quick menu, theme, and data split facts

- The sidebar Settings button opens a compact quick menu on non-settings routes. It shows the active account/plan, rate-limit usage, `Reload app-server`, and a `Settings` link.
- Agent defaults are rendered as a native-style explanatory list. The default model is a searchable custom dropdown populated from the same model registry as the composer; a configured model not currently in that registry is retained as an option.
- Activity is a read-only summary page. A non-JSON response from `/codex-api/activity-summary` is treated as an old web host and produces a restart instruction instead of a JSON parse error.
- Data is a separate routed page for archived-chat management, including list, restore, and load-more actions.
- Appearance keeps System, Light, and Dark choices. The selected mode writes `codex-theme-v1` with the requested Absolutely Light or Dark palette and applies matching CSS variables to the app surface.
