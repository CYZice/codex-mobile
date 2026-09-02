# Project and chat sidebar flow on mobile

## Feature/Change Name

Project groups use normal document flow unless a project is actively being dragged, so Chats follows the project list without a stale blank region.

## Prerequisites/Setup

1. Open the app on a mobile viewport with at least several projects and a projectless chat.
2. Ensure at least one project can be collapsed and expanded.

## Exact Actions

1. Open the sidebar and inspect the gap between the final project row and the Chats header.
2. Collapse and expand several projects, then switch the sidebar search on and off.
3. Refresh the page and reopen the sidebar.
4. Drag a project to a different position, release it, and inspect the sidebar again.
5. Repeat the checks in dark theme.

## Expected Results

- Chats follows the visible project content with only the normal section spacing; no viewport-sized blank area appears.
- Collapsing, expanding, filtering, and refreshing do not leave stale project height behind.
- Project reordering continues to animate while dragging and the final order persists after release.
- Light and dark sidebar surfaces remain readable.

## Rollback/Cleanup

- Restore the original project order if a disposable project was moved for testing.
