# Routed settings, native Codex config, and activity facts

- Settings uses `#/settings/:section` and renders one category at a time: General, Agent, Appearance, Voice, Personalization, Data & activity, or Accounts & limits.
- Telegram configuration remains supported by the backend but is intentionally absent from settings UI.
- Agent defaults use app-server `config/read` and `config/batchWrite`, with the app-server layer metadata selecting User `config.toml` or the active project's `.codex/config.toml`.
- Editable native keys are model, reasoning effort, approval policy, sandbox mode, workspace network access, web search, model verbosity, and reasoning summary.
- Session permission/model controls remain in the composer; Settings does not invent a session config layer.
- Activity is a read-only aggregate of user and legacy-user rows in `state_5.sqlite`; it reports chat count, archive count, active days, token total, top model, and top reasoning effort without parsing rollout transcripts.
- Settings search filters category navigation. Mobile keeps the teleported settings controls mounted while the drawer is closed.
- Composer plugin results are cached per cwd. Plugin and ChatGPT conversation requests retry once and surface a Retry action after repeated failure; ChatGPT conversations are paged at 50 rows.
