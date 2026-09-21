### Feature: Proactively refresh the current thread without a manual button

#### Prerequisites
- Open an existing thread with at least one completed assistant response.
- Keep the browser notification stream connected, then optionally interrupt the connection while a turn finishes to reproduce a stale frontend.

#### Steps
1. Start a response and confirm the conversation has no manual refresh button.
2. Switch away from the browser window and return while the selected thread is active.
3. Confirm the browser remains on the same thread and the selected project/process context is unchanged.
4. Repeat while the browser is missing a completed response that is already visible after a full page reload.
5. Disconnect and reconnect the notification stream after the thread was already loaded.
6. Leave a turn running for at least one 5-second polling interval, then confirm the persisted state is reconciled.
7. Repeat in light theme, dark theme, and a 375 x 812 mobile viewport.

#### Expected Results
- Returning to the page performs one authoritative current-thread read without reloading the page.
- A stale frontend is silently reconciled with the persisted server response.
- Notification-stream events and reconnection automatically recheck an already-loaded selected thread.
- An active turn receives low-frequency foreground polling; idle threads do not poll continuously.
- Only a compact one-line error appears when an automatic sync fails; successful syncs are silent.

#### Rollback/Cleanup
- No persistent state is created. Reconnect the notification stream if it was interrupted for the test.
