### Shared unread thread state

#### Feature/Change Name
Unread state is shared through the Codex host so opening a thread on one device clears its blue indicator everywhere.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`).
2. Two browser clients connected to the same Codex host are available.
3. At least two existing threads are present.
4. Light theme and dark theme are available from the appearance switcher.

#### Steps
1. Load both clients in light theme and confirm existing threads are not all marked unread.
2. Complete a turn in an unselected thread and confirm it shows a blue unread indicator.
3. Open that thread from the first client.
4. Without refreshing the second client, confirm the indicator is cleared there too.
5. Create or receive an update in a second unselected thread, then confirm only that thread is unread.
6. Switch to dark theme and repeat steps 2 through 5.

#### Expected Results
- Existing threads do not become unread merely because of a list refresh or timestamp migration.
- A completed background turn marks only its own thread unread.
- Opening a thread clears only that thread and persists the shared read state for other clients.
- Connected clients receive the shared unread-state update without a full thread-list refresh.
- Unread indicators remain readable in both light theme and dark theme.

#### Rollback/Cleanup
- Remove any disposable test threads created for this validation.

---
