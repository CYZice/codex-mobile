# Routed settings and native Codex configuration

Source: [routed settings facts](../../raw/features/routed-settings-native-config-activity-2026-09-02.md).

The settings center is a routed, category-specific surface rather than a sidebar popup or a long page. General, Agent, Appearance, Voice, Personalization, Data & activity, and Accounts & limits each have a stable URL and only the active category is rendered.

Agent defaults deliberately reuse Codex app-server configuration. User scope targets the user `config.toml`; Project scope derives the active project's `.codex/config.toml` from app-server layer metadata. Session overrides remain composer controls, matching their per-chat lifetime.

Activity reads aggregate columns from the local thread index. It does not scan JSONL transcripts, so the request count and work remain bounded. Legacy rows with no `thread_source` are counted with explicit user threads; subagent and automation rows are excluded.

Telegram is a backend-only integration in this UI. Removing it from Settings does not delete bridge routes or saved configuration.
