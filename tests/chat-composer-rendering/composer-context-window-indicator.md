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
6. At a mobile viewport (for example, 375x812), confirm the context ring is hidden and the model control remains on the composer footer row.
7. On desktop, confirm the footer order is `+`, permissions, plan (when active), spacer, context ring, model, then microphone/send.
8. On mobile, confirm permissions and model remain above the input, `+` stays to the left of the input, the send button appears only when content exists, and the context ring is hidden.
9. Open the `+` menu on desktop and mobile and confirm attachments, folder, camera, plan mode, plugins, send mode, and fast mode are present, but permissions are not duplicated inside the menu.
10. Open a thread that has no context-window data and confirm no empty ring or tooltip is rendered.

## Expected results

- The ring tracks context used; warning and danger colors appear as remaining context falls.
- The tooltip data matches the current thread token-usage snapshot.
- The model control remains usable and does not overlap the context indicator, microphone, or send button.
- Light and dark surfaces remain readable.
- Mobile omits the context ring so it cannot displace footer controls.
- The mobile `+` menu keeps separate photo/file, folder, and camera entry points.
- Desktop shows permission selection beside `+`; mobile shows the original permission control above the input.
- The `+` menu does not contain a second permission control.
- The `+` and `$` menus share the same surface, width, maximum height, scrolling, and outside-click/Escape behavior.

## Rollback and cleanup

- No data is written by viewing the indicator.
