### Feature: Refresh the current thread without reloading the page

#### Prerequisites
- Open an existing thread with at least one completed assistant response.
- Keep the browser notification stream connected, then optionally interrupt the connection while a turn finishes to reproduce a stale frontend.

#### Steps
1. Click the small refresh button at the top-right of the conversation.
2. Confirm the browser remains on the same thread and the selected project/process context is unchanged.
3. Repeat while the browser is missing a completed response that is already visible after a full page reload.
4. Repeat while the server still reports the turn as running.
5. Disconnect and reconnect the notification stream after the thread was already loaded.
6. Repeat in light theme, dark theme, and a 375 x 812 mobile viewport.

#### Expected Results
- Refresh performs one authoritative current-thread read and does not reload the page.
- A stale frontend is reconciled with the persisted server response and reports that the page had fallen behind.
- If the snapshot is unchanged and still active, feedback states that the server still reports the turn as running.
- If the snapshot is unchanged and idle, feedback states that messages are already current.
- Notification-stream reconnection automatically rechecks an already-loaded selected thread.
- The button has a visible loading state and remains legible in light and dark themes.

#### Rollback/Cleanup
- No persistent state is created. Reconnect the notification stream if it was interrupted for the test.
