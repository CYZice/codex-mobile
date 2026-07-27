### Thread permissions

#### Feature/Change Name
Per-thread Workspace access and Full access selection in the composer.

#### Prerequisites/Setup
1. Start the app with `pnpm run dev --host 127.0.0.1 --port 4173`.
2. Open one existing project thread and keep a second project thread available.
3. Make light and dark themes available from the appearance setting.

#### Steps
1. In the first thread, open `Permissions: Workspace` and confirm the Workspace access description.
2. Select Full access and confirm the warning dialog; choose Cancel and verify the selection remains Workspace access.
3. Select Full access again and choose Enable Full Access.
4. Send a message, refresh the page, then reopen the thread.
5. Switch to the second thread and select Workspace access; return to the first thread.
6. Start a long-running turn, open Permissions, switch its selection, and verify the menu says the change applies to the next message.
7. Repeat the menu and confirmation checks in dark theme and at a narrow mobile viewport.
8. At 375x812, verify the combined model-and-thinking control, permission control, and skills control appear in one horizontally scrollable pill row above the input.
9. Open the combined model control and verify every available GPT-5.6 and GPT-5.5 model is visible immediately without searching; select one and verify it updates independently of the thinking level.
10. Open Other models and verify the remaining server-provided models are available; return and open Thinking to change the reasoning level.
11. Open the permission menu on mobile and verify it uses the available screen width, shows descriptions without clipping, and marks the selected preset with a check.

#### Expected Results
- Workspace access uses the current project path as its writable root and asks before broader access.
- Full access requires confirmation on each selection and only applies to the next submitted turn when a turn is already running.
- The selected permission persists after refresh and remains scoped to its thread.
- The second thread can use a different permission without changing the first thread.
- Both themes and narrow layouts keep the menu and confirmation dialog readable without overlap.
- Mobile keeps model plus thinking together in one control, shows GPT-5.5/GPT-5.6 choices before Other models, and does not render a separate thinking pill or wrap it onto another row.

#### Rollback/Cleanup
- Switch any temporary Full access thread back to Workspace access after the check.
