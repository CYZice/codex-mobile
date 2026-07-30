### Thread archive recovery and sidebar pruning

#### Feature/Change Name
Deleting a thread recovers from Codex `no rollout found` archive failures and removes successfully archived threads from the sidebar immediately.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Codex CLI available on `PATH`
3. At least one normal thread and one newly-created thread that has not yet produced a rollout
4. Light theme and dark theme both available from the appearance switcher

#### Steps
1. In light theme, create a new empty thread from the sidebar.
2. Open that thread's menu and choose `Delete thread`.
3. Confirm the thread disappears from the sidebar without a `no rollout found` error.
4. Rename another visible thread, then delete it.
5. Confirm the renamed thread disappears immediately and does not reappear after sidebar refresh/background pagination.
6. Call `thread/list` with `archived:false` through `/codex-api/rpc` and confirm the deleted thread ids are absent.
7. Call `thread/list` with `archived:true` and confirm the deleted thread ids are present.
8. Switch to dark theme and repeat steps 1-5.

#### Expected Results
- Empty or not-yet-materialized threads are archived after CodexUI sets a fallback name and retries.
- Already archived threads are treated as archived instead of surfacing a stale `no rollout found` error.
- The sidebar prunes archived ids from its accumulated paginated list before refreshing.
- Older unarchived threads may appear as the list refills, but archived threads do not remain visible.
- Behavior is consistent in light and dark themes.

#### Rollback/Cleanup
- None.

---
### Archived chats management

#### Feature/Change Name
Settings exposes archived chats with pagination and restore actions.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`).
2. At least two archived threads are available.

#### Steps
1. Open Settings and expand `Archived chats`.
2. Confirm archived threads load and use `Load more` when it is offered.
3. Restore one archived thread.
4. Confirm it disappears from Archived chats and reappears in the main sidebar after the background refresh.
5. Repeat in light and dark themes.

#### Expected Results
- Archived threads are not shown in the normal sidebar list.
- Restore succeeds without reloading the page and preserves the remaining archived list.
- Controls and text remain readable in both themes.

#### Rollback/Cleanup
- Re-archive any disposable thread restored during the test.

---
### Edit and retry historical messages

#### Feature/Change Name
Editing or retrying a previous user message rolls back that turn and all later turns before restoring the composer draft or sending the retry.

#### Prerequisites/Setup
1. A thread with at least two completed user/assistant turns.
2. The first user turn contains text, an image, or a selected skill.

#### Steps
1. Use `Edit message` on the first user message.
2. Wait for the conversation to finish rolling back.
3. Confirm the original text, image, and skill selections are restored in the focused composer, then edit and send it.
4. Create another completed turn, then use `Retry` on its user message.

#### Expected Results
- The target turn and every later turn disappear before edit/retry continues.
- Edit does not put a draft into the composer until rollback has succeeded.
- Retry immediately starts one replacement turn with the original text, images, and skills.

#### Rollback/Cleanup
- Use a disposable thread because retry intentionally rewrites later history.
