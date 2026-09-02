### Thread permissions

#### Feature/Change Name
Per-thread Auto-review, Workspace access, and Full access selection in the composer.

#### Prerequisites/Setup
1. Start the app with `pnpm run dev --host 127.0.0.1 --port 4173`.
2. Open one existing project thread and keep a second project thread available.
3. Make light and dark themes available from the appearance setting.

#### Steps
1. Open a new-chat screen and confirm `Permissions: Auto-review` is selected by default.
2. In the first existing thread, open Permissions and confirm its previously saved selection is unchanged after upgrading.
3. Select Full access and confirm the warning dialog; choose Cancel and verify the selection remains unchanged.
4. Select Full access again and choose Enable Full Access.
5. Send a message, refresh the page, then reopen the thread.
6. Switch to the second thread and select Workspace access; return to the first thread.
7. Start a long-running turn, open Permissions, switch its selection, and verify the menu says the change applies to the next message.
8. Repeat the menu and confirmation checks in dark theme and at a narrow mobile viewport.
9. On desktop, verify the footer order is `+`, permission, plan (when active), spacer, context ring, model, then microphone/send.
10. On mobile, verify the original layout is restored: permission and model above the input, `+` on the input's left, input in the center, and no context ring.
11. Open the desktop `+` menu and verify permissions are not duplicated inside it; open `$` and verify its menu uses the same width, surface, maximum height, and scrolling behavior.
12. Open the permission control on mobile and verify it remains above the input, uses the available screen width, shows descriptions without clipping, and marks the selected preset with a check.
13. At 375x812 in light and dark themes, compare the closed permission and model controls: both must be 36px-high rounded capsules on the same row, with no vertical drift.
14. In dark theme, open both `+` and `$`; verify primary labels, descriptions, disabled rows, dividers, and selected rows remain legible against the dark menu surface.

#### Expected Results
- Workspace access uses the current project path as its writable root and asks before broader access.
- Auto-review keeps workspace limits and routes broader approval requests through Codex automatic review.
- A one-time migration changes only the new-chat default to Auto-review and preserves every existing per-thread override.
- Full access requires confirmation on each selection and only applies to the next submitted turn when a turn is already running.
- The selected permission persists after refresh and remains scoped to its thread.
- The second thread can use a different permission without changing the first thread.
- Both themes and narrow layouts keep the menu and confirmation dialog readable without overlap.
- Desktop places permission beside `+` while mobile keeps the original permission-above-input layout.
- The desktop `+` menu contains attachment/folder/camera, plan, plugin, send-mode, and fast-mode actions, but no duplicate permission control.
- The `+` and `$` menus remain bounded and vertically scrollable without covering the input.
- Mobile permission and model controls share the same capsule treatment and vertical alignment.
- Dark composer menus use light primary text, muted but readable secondary text, visible dividers, and a distinct selected-row surface.

#### Rollback/Cleanup
- Switch any temporary Full access thread back to Workspace access after the check.
