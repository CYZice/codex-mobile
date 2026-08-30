# Fork waits for the active turn to settle

### Feature: Fork is hidden while any turn is responding or stopping

#### Prerequisites
- Open a thread with at least one completed assistant response.
- Send a subsequent message that produces a visibly streaming response or tool activity.

#### Steps
1. While the later turn is still generating, inspect the completed assistant response before it.
2. Confirm Fork is not rendered or is unavailable while the thread is in progress.
3. Stop the turn and confirm Fork remains unavailable until the stopped state is persisted.
4. After normal completion or persisted stop, confirm Fork appears and opens a child thread with the selected response and earlier history.
5. Repeat in dark theme and on a touch-sized viewport.

#### Expected Results
- No message exposes Fork while a turn is active or stop-pending.
- The child thread opens only after the source turn is settled and contains the selected response and earlier history only.
- The Fork control is discoverable by keyboard focus and without hover on touch-sized viewports.

#### Rollback/Cleanup
- Archive the test child thread after verification.
