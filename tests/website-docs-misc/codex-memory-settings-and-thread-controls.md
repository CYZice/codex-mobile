### Codex memory settings, `/memories`, and diagnostics

#### Prerequisites/setup

- Start CodexMobile with a local Codex app-server.
- Use a clean browser profile or clear only the CodexMobile local storage keys.
- Keep one existing thread and create one new thread for the persistence checks.

#### Exact actions

1. Open Settings > Personalization.
2. Confirm the local memory switch is off by default when no explicit memory configuration exists.
3. Turn on local memories, existing-memory use, and chat memory generation; leave external-context suppression off; save.
4. Confirm the app-server reload completes and reopen Personalization to verify the values persist.
5. Open an existing thread and submit `/memories`.
6. Toggle the two current-chat controls independently and close the dialog.
7. Switch to another thread, set a different pair of values, refresh the page, and return to both threads.
8. Submit `/memories use off` and `/memories generate on`; confirm the visible feedback reflects each change and no model turn is created.
9. Open Settings > Activity and refresh diagnostics.
10. Confirm the page shows the app-server memory enablement, generation status, and local memory storage path without exposing credentials.

#### Expected results

- Global memory settings persist through reload and are written to the User Codex configuration.
- `/memories` opens a current-thread control dialog and never sends the command as a prompt.
- Each thread restores its own memory controls after navigation and browser refresh.
- Explicit CLI memory flags continue to override the persisted default.
- Activity diagnostics show `Unknown` or `Not exposed by app-server` when the external app-server does not report background generation state.

#### Rollback/cleanup

- Turn all global memory settings off and save.
- Remove the thread-memory local storage key if test data should not remain.
- Restart CodexMobile if the app-server was left in a failed reload state.
