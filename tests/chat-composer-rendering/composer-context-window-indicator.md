# Composer context-window indicator

## Prerequisites

- Start codexapp with an available Codex app-server.
- Open an existing thread that has reported token usage and a model context-window size.
- Make light and dark themes available.

## Steps

1. In light theme, inspect the composer footer.
2. Confirm the context ring appears directly before the model control, with the model aligned to the right side before the microphone and send controls.
3. Hover or keyboard-focus the ring.
4. Confirm the tooltip shows context-window title, used and remaining percentages, and used tokens over total context tokens.
5. Switch to dark theme and repeat steps 1-4.
6. Open a thread that has no context-window data and confirm no empty ring or tooltip is rendered.

## Expected results

- The ring tracks context used; warning and danger colors appear as remaining context falls.
- The tooltip data matches the current thread token-usage snapshot.
- The model control remains usable and does not overlap the context indicator, microphone, or send button.
- Light and dark surfaces remain readable.

## Rollback and cleanup

- No data is written by viewing the indicator.
