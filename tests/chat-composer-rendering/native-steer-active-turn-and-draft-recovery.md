### Native steer during an active turn and draft recovery

#### Feature/Change Name
Active-turn follow-ups use the native Codex `turn/steer` path, render after the live response, and restore the draft if sending fails.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. A thread that produces a response long enough to remain in progress
3. Light theme and dark theme are available

#### Steps
1. In light theme, start a long-running request and wait for visible streamed output.
2. Select Steer, enter a follow-up, and submit it while output is still streaming.
3. Confirm the composer clears immediately and the follow-up row appears after the currently streamed output.
4. Simulate or induce a failed steer request, then confirm the full draft (text, images, files, and skills) returns to the composer.
5. Submit a steer while the active turn is completing; confirm the follow-up still starts as a normal next turn rather than being lost.
6. Switch to dark theme and repeat steps 1 through 5.

#### Expected Results
- Active follow-ups are appended to the current turn and do not create a second in-progress turn.
- The optimistic steer row is visible at the bottom of the live conversation, never before the active streamed assistant row.
- The composer stays immediately usable after submit; a failed request restores the complete draft.
- A completion race sends the follow-up as the next normal turn exactly once.
- Light and dark themes keep the optimistic user row and composer controls readable.

#### Rollback/Cleanup
- Remove any disposable test thread or queued messages created during verification.
