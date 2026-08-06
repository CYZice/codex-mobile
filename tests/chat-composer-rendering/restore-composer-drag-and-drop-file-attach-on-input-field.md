### Feature: Restore composer drag-and-drop file attach on input field

#### Prerequisites
- App is running with a selected thread and active composer.
- At least one local file is available to drag from Finder/File Explorer.

#### Steps
1. Use `+` > `Add photos & files` to select a non-image file.
2. Verify its filename appears in a composer file chip and the send button becomes available.
3. Drag a file over the composer input area.
4. Confirm drag highlight/overlay appears above the input.
5. Drop the file on the composer input field.
6. Verify the file is attached in composer chips.
7. Repeat with an image file and verify image preview appears.
8. In dark mode, repeat steps 3-4 and verify overlay remains readable.
9. With an expired or invalid web login session, select a file and verify a visible attachment failure message appears instead of a silent no-op.

#### Expected Results
- Composer shows drag-active visual state while file is hovering.
- Selected and dropped files are attached through the same attachment pipeline as regular uploads.
- Image drops create image preview attachments.
- Failed uploads show attachment feedback in the composer.
- Dark mode drag overlay uses dark-theme colors and remains legible.

#### Rollback/Cleanup
- Remove attached files/images from the composer before closing the test thread.
