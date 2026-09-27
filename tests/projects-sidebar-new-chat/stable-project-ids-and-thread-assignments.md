# Stable project IDs and server-side thread assignments

## Feature/Change Name

Local project names, roots, ordering, and thread assignments persist in Codex global state.

## Prerequisites/Setup

1. Use an isolated `CODEX_HOME` containing two local projects with distinct IDs and the same leaf folder name.
2. Start the current build and open it in two browser contexts.

## Steps

1. Confirm `GET /codex-api/local-projects-state` returns both IDs, all `rootPaths`, and `threadAssignments`.
2. Edit a project name and add a second root, then save. Refresh both contexts.
3. Confirm the ID remains unchanged, both roots remain present, and the second context shows the new name.
4. Move a chat to the project and refresh. Confirm the chat remains grouped there while its `cwd` is unchanged.
5. Move the chat to “No project” and confirm it remains in “Chat without project” even when its `cwd` matches a project root.
6. Remove the project and confirm its chats remain visible under another matching root or “Chat without project”.
7. Add a folder to the editor and cancel. Confirm the global state file is unchanged.
8. Create or load two projects with the same display name, then use Edit, Remove, New thread, Browse files, and drag reorder on each project independently.

## Expected Results

- Duplicate leaf names remain separate by stable project ID.
- Save is atomic for name, roots, labels, and ordering.
- Assignment writes are server-side and shared by both browser contexts.
- Removing a project clears assignments without deleting chats or files.
- “No project” is an explicit persisted assignment; it does not immediately fall back to `cwd` inference.
- Same-named projects keep independent menus, editor drafts, root paths, new-thread cwd, and ordering because UI actions use `projectId`.

## Rollback/Cleanup

Stop the isolated server and remove only the isolated `CODEX_HOME` and test directories.
