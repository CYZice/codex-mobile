### Feature: Mobile composer attachment grid and compact command rows

#### Prerequisites
- Start the app from this repository (`pnpm run dev`).
- Open a thread with the composer enabled on a phone-sized viewport, or on a real mobile device.
- Have three image files available for attachment.
- Open a thread containing several completed command messages, including one grouped command block.

#### Steps
1. Switch between light and dark themes.
2. Attach three images through the composer.
3. Confirm the image previews are shown in one row with three equal tiles on the mobile viewport.
4. Scroll to the completed command messages.
5. Confirm collapsed command rows are adjacent and do not reserve large blank vertical areas.
6. Expand one command group and one command output, then collapse them again.
7. Confirm the command output opens and closes without leaving blank space after collapsing.
8. Confirm no upstream-model status label is displayed anywhere in the mobile conversation view.
9. Repeat steps 2–8 in the other theme.

#### Expected Results
- Three selected image previews form a three-column grid on mobile.
- Command rows remain compact when collapsed, including after expanding and collapsing output.
- The mobile conversation does not render the upstream-model status control.
- The layout remains readable in both light and dark themes.

#### Rollback/Cleanup
- Remove the image attachments from the composer or discard the draft after testing.
