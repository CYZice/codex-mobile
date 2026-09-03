# Inline user-message edit and completed-turn actions

## Feature/Change Name

Codex Desktop-style inline editing and completed-turn actions for persisted messages.

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
6. Confirm the original message and later turns remain in place while the edited text is sent as a new message without copying it into the bottom composer.
7. While the edited turn is responding, confirm Edit and Fork are hidden or unavailable.
8. After the response is fully persisted, confirm Fork becomes available; Copy remains available for completed responses.
9. Start another turn and confirm Edit and Fork stay unavailable until that turn completes or a stopped turn is persisted.
10. Repeat at 375x812 and in dark theme.

## Expected Results

- Edit is contained inside the original user-message bubble.
- Cancel has no thread or filesystem effect.
- Send is disabled for empty text and shows a pending state during rollback/send.
- If edit resend fails, the inline editor stays open with a visible error and the original message remains in the conversation.
- Original images, files, and skills remain attached to the edited resend.
- Fork is available only after a turn is complete and persisted, never while a response or stop request is still in flight.
- Fork and copy actions show an immediate disabled/spinner or copied state rather than appearing inert.

## Rollback/Cleanup Notes

- Allow the final edited turn to complete or archive the disposable test thread.
