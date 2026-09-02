# Routed settings and native Codex configuration

Sources: [routed settings facts](../../raw/features/routed-settings-native-config-activity-2026-09-02.md) and [settings UX/theme facts](../../raw/features/settings-quick-menu-theme-data-split-2026-09-02.md).

The settings center is a routed, category-specific surface rather than a sidebar popup or a long page. General, Agent, Appearance, Voice, Personalization, Activity, Data, and Accounts & limits each have a stable URL and only the active category is rendered. The collapsed sidebar exposes a quick menu with the active account, usage, app-server reload, and a link into Settings.

Agent defaults deliberately reuse Codex app-server configuration. User scope targets the user `config.toml`; Project scope derives the active project's `.codex/config.toml` from app-server layer metadata. Session overrides remain composer controls, matching their per-chat lifetime.

Activity reads aggregate columns from the local thread index. It does not scan JSONL transcripts, so the request count and work remain bounded. Legacy rows with no `thread_source` are counted with explicit user threads; subagent and automation rows are excluded. Data owns archived-chat management on a separate page. If an older web host returns the SPA HTML shell for the activity endpoint, the UI explains that Codex Mobile must be restarted.

Appearance preserves System, Light, and Dark modes and writes the supplied `codex-theme-v1` Absolutely palette, including surface, ink, accent, diff, and skill colors.

Telegram is a backend-only integration in this UI. Removing it from Settings does not delete bridge routes or saved configuration.
