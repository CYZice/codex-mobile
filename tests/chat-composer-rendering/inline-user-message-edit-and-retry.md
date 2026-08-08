# Inline user-message edit and retry

## Feature/Change Name

Codex Desktop-style inline editing and direct retry for persisted user messages.

## Prerequisites/Setup

1. Open a completed thread containing at least two user turns.
2. Ensure the thread is idle.
3. Test in both light and dark themes.

## Exact Actions

1. Hover a persisted user message and select **Edit message**.
2. Confirm the original message bubble becomes an inline textarea with **Cancel** and **Send** actions.
3. Change the text, then select **Cancel**.
4. Confirm the original message and later turns remain unchanged.
5. Edit the same message again, change the text, and select **Send**.
6. Confirm the thread rolls back from that turn and immediately sends the edited text without copying it into the bottom composer.
7. Select **Retry** on another persisted user message.
8. Confirm retry keeps the original message visible, shows **Retrying in this thread…** beside it, and appends a new retry turn without opening either editor.
9. While the retry is pending, switch to a different thread, send or start another action there, then return to the original thread.
10. Repeat at 375x812 and in dark theme.

## Expected Results

- Edit is contained inside the original user-message bubble.
- Cancel has no thread or filesystem effect.
- Send is disabled for empty text and shows a pending state during rollback/send.
- A failed rollback leaves the inline editor open with the edited text intact.
- If edit resend fails after rollback, the inline editor stays open with a visible error; the original message is still available.
- If retry fails, the original message remains visible and shows a retry failure state with a retryable action.
- Original images, files, and skills remain attached to the edited resend.
- Retry remains a one-click direct resend in the original thread, even after switching threads while it is pending.
- Fork and copy actions show an immediate disabled/spinner or copied state rather than appearing inert.

## Rollback/Cleanup Notes

- Allow the final retried turn to complete or archive the disposable test thread.
