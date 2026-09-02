### User messages are visible immediately in new and existing chats

#### Feature/Change Name
New-thread and existing-thread sends render the submitted user message immediately, even when backend persistence lags behind the live activity overlay.

#### Prerequisites/Setup
1. Create a fresh isolated `CODEX_HOME`.
2. Start local Vite: `CODEX_HOME=<temp-home> npm run dev -- --host 127.0.0.1 --port 4173`.
3. Use an explicit test project folder to avoid projectless folder-name collisions from repeated `hi` tests.

#### Steps
1. In light theme, open `http://127.0.0.1:4173/?openProjectPath=<encoded-test-project-path>`.
2. Send `hi` in a new unauthenticated chat and confirm the composer retains the submitted text in a read-only sending state with a spinner while the thread is being created.
3. Confirm that once the thread opens, the conversation pane immediately shows the user row `hi` and the composer is cleared.
4. Copy `/Users/igor/.codex/auth.json` to `<temp-home>/auth.json`.
5. Restart the same Vite server with the same `CODEX_HOME`.
6. Open the same project path, create another new chat, and send `hi`.
7. Confirm the user row appears before the assistant response finishes.
8. Open an existing idle thread, send a unique message, and confirm its user bubble appears before the `Sending message` activity row, then changes to `Thinking` when execution starts.
9. Simulate or trigger a rejected turn start and confirm the composer restores full editability with the original text and attachments intact.
10. Repeat the sending, failure, and recovery checks in dark theme and at a mobile viewport.
11. Wait for persistence/refresh and confirm the optimistic row is replaced without a duplicate.

#### Expected Results
- The composer never becomes blank before the app can show either a sending state or the submitted user message.
- The submitted first user message appears in the conversation pane immediately after thread creation.
- Backend refreshes that contain only the assistant item do not temporarily remove the optimistic user row.
- When the backend later returns the real user item, the optimistic row is replaced without a duplicate.
- Completion events refresh the selected thread even when it was already marked loaded by an optimistic first message.
- Delayed GPT-5.4-mini replies appear automatically when the completion notification arrives; no manual refresh is required.
- Light and dark theme message rows remain readable.
- Existing threads never show `Thinking` in place of the just-submitted user message; `Sending message` is shown until the turn begins.
- A rejected send leaves the complete draft available for correction or another send attempt.

#### Rollback/Cleanup
- Stop the temporary Vite server.
- Remove the temporary isolated `CODEX_HOME` and test project folder.

---
