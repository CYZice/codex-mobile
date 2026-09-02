# Desktop local projects and web project persistence

## Feature/Change Name

Desktop `local-projects` discovery and web-added project persistence use one backend state adapter.

## Prerequisites/Setup

1. Use an isolated `CODEX_HOME`; do not use the production profile for destructive cases.
2. Seed `.codex-global-state.json` with one saved workspace root and a different `local-projects` record whose ID appears in `project-order`.
3. Start the current build on an isolated port.
4. Have two browser contexts or devices pointing to that same server.

## Steps

1. Fetch `/codex-api/workspace-roots-state` and confirm both the saved root and Desktop-only `rootPaths` entry are returned.
2. Confirm the Desktop project name is returned as the label when no explicit workspace label exists.
3. In browser A, add an existing local folder as a project.
4. Read the isolated `.codex-global-state.json` and confirm the folder exists in both `electron-saved-workspace-roots` and one `local-projects[*].rootPaths` entry.
5. Confirm `project-order` contains the new project ID and does not contain the absolute path.
6. Open or refocus browser B, wait at least two seconds, and refresh the project list.
7. Confirm the new project appears in browser B without re-adding it.
8. Rename the project in browser A and confirm the existing local-project record keeps unknown fields while its name and `updatedAt` change.
9. Remove the test project in browser A and confirm the matching saved root, local-project record, and project-order ID are removed.
10. In browser A add and start a thread in another local project. In browser B, which was already open, reorder only its older visible projects.
11. Refresh both browser A and browser B, then open the same server through `127.0.0.1:5900`.

## Expected Results

- Desktop-only projects are not hidden by an incomplete saved-roots list.
- Web-added projects are registered in the Desktop local project model and survive a new browser/device session on the same host.
- Disk `project-order` remains ID-based while the web API remains path-based.
- Existing pages revalidate external project-state changes after the bounded cache window.
- A stale reorder preserves projects added by another page; it changes only the ordering of projects it knows.
- Starting a local thread in an existing unregistered directory registers it in the Desktop project model before the thread becomes visible.
- Unrelated global-state fields remain semantically unchanged after JSON parsing and serialization.

## Rollback/Cleanup

- Stop the isolated server.
- Remove only the isolated `CODEX_HOME` and test project directories.
- Do not restore the isolated state over the production `.codex-global-state.json`.
