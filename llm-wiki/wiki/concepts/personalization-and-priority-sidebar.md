# Personalization and priority sidebar

Source: [global-instructions-and-priority-sidebar-2026-08-30.md](../../raw/features/global-instructions-and-priority-sidebar-2026-08-30.md)

## Global AGENTS.md editing

The Personalization route exposes the same global instruction file used by Codex: `CODEX_HOME/AGENTS.md`. The bridge returns enough metadata for the UI to explain symbolic links and an active `AGENTS.override.md`. Writes deliberately follow a symbolic link rather than replacing it because this repository can link the global file into the synchronized skills directory.

The editor accepts exact UTF-8 content, including an empty file. It shows a byte count and warns beyond 32 KiB. A successful save promises only that new chats and runs will discover the updated instructions.

## Priority activity semantics

The bell is an alternate view over the already-loaded thread groups. It does not replace or mutate project/pin organization. Priority is status-driven: unread, running, approval-pending, and response-pending threads appear first. Every other thread appears once in chronological local-date sections.

The transformation is local and bounded by the existing thread list: one de-duplication pass, one sort, then grouping. Search uses the existing local/server matched IDs, and thread menus continue through the original handlers.

## Operational note for ChatGPT references

Conversation-list errors must remain visible and retryable. A generic empty state hides whether the cause is authentication, proxy routing, or a stale deployed process. On the managed Windows installation, rebuild and component restart are separate steps because the `5900` Node process does not reload modified server modules automatically.
