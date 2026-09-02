# Projectless chat and ChatGPT proxy facts — 2026-08-30

- Codex Desktop creates ordinary chats under `~/Documents/Codex/YYYY-MM-DD/<prompt-slug>` before `thread/start`.
- The generated directory is sent as `cwd` and `outputDirectory`; `workspaceRoot` is `~/Documents/Codex`.
- These generated directories belong in Chats and must not be persisted as ordinary project workspace roots.
- The Web global new-thread action intentionally keeps the active project, while the folder picker exposes an explicit ordinary-chat choice and the Chats action selects it directly.
- ChatGPT conversation list/detail and connector-logo requests originate in the local Node bridge, not the browser.
- Node global fetch did not honor the machine's Windows/Clash proxy, causing `/codex-api/chatgpt-conversations` to return `502` with `fetch failed` while Desktop still worked through Electron's system network stack.
- The bridge now resolves `HTTPS_PROXY`/`HTTP_PROXY` first, falls back to the enabled Windows Internet Settings proxy, honors `NO_PROXY`, caches registry discovery, and uses an Undici `ProxyAgent` when needed.
