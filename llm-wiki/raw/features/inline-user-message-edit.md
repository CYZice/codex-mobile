# Inline user-message editing reference

The Codex Desktop reference supplied for this implementation shows a persisted user message turning into an editor in the original message bubble. The editor retains the message text and exposes Cancel and Send actions.

For this web implementation:

- entering edit mode must not roll back the thread
- Cancel must leave the thread unchanged
- Send performs rollback followed by an immediate resend of the edited text
- message images, files, and skills remain attached
- Retry remains a direct rollback and resend without opening an editor
- rollback failure keeps the inline editor and edited text available
- resend failure after rollback is surfaced through the existing thread error state

Reference image: `output/playwright/inline-message-edit-codex-reference.png`.
