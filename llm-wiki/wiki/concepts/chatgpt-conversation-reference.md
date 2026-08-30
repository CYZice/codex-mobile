# ChatGPT conversation reference

The composer can reference an existing ChatGPT conversation without creating a new project or exposing the full remote transcript to the web UI. Opening `+` lazily requests normalized summaries from the local bridge. Selecting a row requests one bounded preview, then appends a clearly marked untrusted reference block to the current draft.

The bridge owns ChatGPT authentication and upstream API calls. It deliberately returns only `conversationId`, `title`, `updatedAt`, and a short preview. This keeps credentials and the full conversation payload server-side while preserving the Desktop-like workflow. If authentication or the upstream request is unavailable, the menu remains usable and selection falls back to a title-only reference.

The `+` menu groups content as Add, Plugins, and ChatGPT conversations. The `$` skill picker uses the same composer surface contract. Desktop permissions are rendered beside `+` using the short preset label; mobile retains its original top-of-input permission/model arrangement.
