# Fork completed response while next turn streams

### Feature: Fork a completed response during a later streaming turn

#### Prerequisites
- Open a thread with at least one completed assistant response.
- Send a subsequent message that produces a visibly streaming response or tool activity.

#### Steps
1. While the later turn is still generating, hover or focus the completed assistant response before it.
2. Select the Fork button on that completed response.
3. Wait for the child thread to open, then inspect its transcript and return to the source thread.
4. Repeat in dark theme and on a touch-sized viewport.

#### Expected Results
- The completed response exposes Fork even while the later turn is active; the live response does not.
- The child thread opens automatically and contains the selected response and earlier history only.
- The source thread keeps generating without interruption and retains its later turn.
- The Fork control is discoverable by keyboard focus and without hover on touch-sized viewports.

#### Rollback/Cleanup
- Archive the test child thread after verification.
