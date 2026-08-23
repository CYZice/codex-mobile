### Feature: Composer draft lifecycle and slash commands

#### Prerequisites
- Run the app with `pnpm run dev --host 127.0.0.1 --port 4173`.
- Keep one existing project thread available with an uncommitted file change.

#### Steps
1. On the new-chat screen, type a unique draft but do not send it; navigate away and return.
2. Confirm the unsent draft is restored, then send it to create a thread.
3. Return to the new-chat screen and confirm the sent text is not restored.
4. Type `/` and verify the command menu contains only `/plan` and `/review`; use arrow keys and Escape once, then reopen it and use touch or Enter to choose a command.
5. On the new-chat screen, run `/plan`, then confirm Plan mode becomes selected without creating an empty turn.
6. In an existing thread, send `/plan inspect this change` and confirm the turn receives `inspect this change` in Plan mode rather than the slash token.
7. In an idle existing thread with an uncommitted change, send `/review`.
8. While a turn is active, try `/review` again.

#### Expected Results
- Only unsent content is restored; a successfully submitted new-chat draft is removed before route navigation.
- A failed first-message send restores text, images, files, and skills for retry.
- The slash menu is keyboard- and touch-operable and does not intercept slash text outside the start of the draft.
- `/plan` changes collaboration mode; inline text and attachments are submitted in Plan mode.
- `/review` starts Codex's inline workspace review in the current thread without opening the Diff pane.
- Review is refused while no existing thread is open or while its turn is active, and the command remains in the composer.

#### Rollback/Cleanup
- Clear any remaining draft and discard the disposable review change or test thread.
