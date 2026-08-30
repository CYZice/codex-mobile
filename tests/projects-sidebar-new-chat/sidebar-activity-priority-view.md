# Sidebar priority activity view

## Prerequisites / setup

- Prepare threads covering unread, running, awaiting approval, awaiting response, idle today, yesterday, within the last week, and older dates.
- Include project and projectless chats, plus at least one duplicate thread returned under more than one group.
- Run in desktop light/dark themes and at 375×812 and 768×1024.

## Actions

1. Load the app with a fresh local-storage profile and confirm the existing Projects/Pinned/Chats tree remains the default.
2. Click the bell beside Search and confirm it becomes active.
3. Confirm Priority contains only unread, running, or pending-request threads, sorted by latest update.
4. Confirm every other visible thread appears once under Today, Yesterday, recent weekday, or an older localized date.
5. Search for a title and confirm both Priority and date groups filter; empty groups disappear.
6. Open a thread menu, select a row, and use pin/archive/rename actions; confirm the existing actions still work.
7. Toggle the bell off and confirm the original tree and its pinned/project organization are unchanged.
8. Reload the page and confirm the selected view persists.
9. Repeat in dark mode and the two mobile/tablet viewports.

## Expected results

- The bell is a view toggle, not a replacement for the default sidebar.
- When inactive and attention threads exist, the bell shows a small orange attention dot.
- Priority uses status semantics rather than a fixed item count, and manually pinned idle threads do not enter Priority.
- Remaining rows are sorted by `updatedAtIso`, fall back to `createdAtIso`, and never duplicate a Priority row.
- Project/cwd subtitles remain visible in activity view, and all existing row actions remain available.
- The grouping is computed locally with no additional thread-list request.

## Rollback / cleanup

- Toggle the bell off to return to the original tree.
- Remove `codex-web-local.sidebar-activity-view.v1` from local storage to reset the default explicitly.
