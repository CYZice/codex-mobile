### Codex memory settings, `/memories`, and diagnostics

#### Prerequisites/setup

- Start CodexMobile with a local Codex app-server.
- Use a clean browser profile or clear only the CodexMobile local storage keys.
- Keep one existing thread and create one new thread for the persistence checks.

#### Exact actions

1. Open Settings > Personalization.
2. Confirm the Codex memory section leaves its `Loading...` state after the User config read completes and shows the four memory controls (or an inline load error instead of staying busy forever).
3. Confirm the local memory switch is off by default when no explicit memory configuration exists.
4. Turn on local memories, existing-memory use, and chat memory generation; leave external-context suppression off; save.
5. Confirm the app-server reload completes and reopen Personalization to verify the values persist.
6. Open an existing thread and submit `/memories`.
7. Confirm the chat-memory dialog is visibly rendered above the app layout, then toggle the two current-chat controls independently and close the dialog.
8. Switch to another thread, set a different pair of values, refresh the page, and return to both threads.
9. Submit `/memories use off` and `/memories generate on`; confirm the visible feedback reflects each change and no model turn is created.
10. Open Settings > Activity and refresh diagnostics.
11. Confirm the page shows the app-server memory enablement, generation status, and local memory storage path without exposing credentials.

#### Expected results

- Global memory settings persist through reload and are written to the User Codex configuration.
- The Personalization memory section always resolves loading independently of the global-instructions editor and reports memory-specific load failures inline.
- `/memories` opens a current-thread control dialog and never sends the command as a prompt.
- The `/memories` dialog is teleported to `body`, so DesktopLayout slots, overflow, and stacking contexts cannot hide it.
- Each thread restores its own memory controls after navigation and browser refresh.
- Explicit CLI memory flags continue to override the persisted default.
- Activity diagnostics show `Unknown` or `Not exposed by app-server` when the external app-server does not report background generation state.

#### Rollback/cleanup

- Turn all global memory settings off and save.
- Remove the thread-memory local storage key if test data should not remain.
- Restart CodexMobile if the app-server was left in a failed reload state.
