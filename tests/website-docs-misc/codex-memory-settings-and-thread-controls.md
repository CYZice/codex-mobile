### Codex memory settings, `/memories`, and diagnostics

#### Prerequisites/setup

- Start CodexMobile with a local Codex app-server.
- Use a clean browser profile or clear only the CodexMobile local storage keys.
- Keep one existing thread and create one new thread for the inheritance checks.

#### Exact actions

1. Open Settings > Personalization.
2. Confirm the Codex memory section leaves its `Loading...` state after the User config read completes and shows the four memory controls (or an inline load error instead of staying busy forever).
3. Confirm the local memory switch, existing-memory use, and memory generation are on by default when no explicit memory configuration exists.
4. Turn on local memories, existing-memory use, and chat memory generation; leave external-context suppression off; save.
5. Confirm the app-server reload completes and reopen Personalization to verify the values persist.
6. Submit `/memories` from either Home or an existing thread.
7. Confirm the dialog is visibly rendered above the app layout and shows the same `Use existing memories` and `Generate memories` values as the global settings.
8. Toggle `Generate memories` off, close the dialog, reopen it, and confirm it remains off. Create a new thread and confirm Codex starts it without any browser-side `config.memories` override.
9. Turn `Generate memories` back on. Confirm newly-created threads inherit the enabled native Codex default.
10. Submit `/memories use off` and `/memories generate on`; confirm the visible feedback reflects the global setting change and no model turn is created.
11. Confirm the legacy `codex-web-local.thread-memory.v1` local-storage key is removed and no per-thread browser memory state is recreated.
12. Open Settings > Activity and refresh diagnostics.
13. Confirm the page shows the app-server memory enablement, generation status, and local memory storage path without exposing credentials.

#### Expected results

- Global memory settings persist through reload and are written to the User Codex configuration.
- The Personalization memory section always resolves loading independently of the global-instructions editor and reports memory-specific load failures inline.
- With no explicit user memory keys, the UI follows the native Codex defaults: memories enabled, existing-memory use enabled, and memory generation enabled.
- `/memories` opens the native global memory use/generation controls and never sends the command as a prompt.
- The `/memories` dialog is teleported to `body`, so DesktopLayout slots, overflow, and stacking contexts cannot hide it.
- New threads inherit the native Codex memory configuration instead of receiving browser-owned thread overrides.
- The obsolete browser per-thread memory map is removed during app initialization.
- Explicit CLI memory flags continue to override the persisted default.
- Activity diagnostics show `Unknown` or `Not exposed by app-server` when the external app-server does not report background generation state.

#### Rollback/cleanup

- Turn all global memory settings off and save.
- Remove the thread-memory local storage key if test data should not remain.
- Restart CodexMobile if the app-server was left in a failed reload state.
