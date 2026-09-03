### Sidebar thread actions, context menu, and empty project cleanup

#### Feature/Change Name
Thread rows show compact pin/archive actions, while the context menu provides grouped thread actions. Empty project groups no longer render a misleading `No threads` row.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Sidebar contains at least two disposable test threads
3. Light theme and dark theme are available from the appearance switcher

#### Steps
1. In light theme, hover a disposable thread row and verify the right-side actions show pin, archive, and more buttons, with no delete button
2. Click the archive icon and verify the archive confirmation dialog opens without selecting the row
3. Confirm the archive and verify the thread is removed from the sidebar immediately and, if it was pinned, removed from the `Pinned` section too
4. Open another thread row context menu and verify it uses icons and separators for rename, pin, archive, file, and copy actions
5. Click `Pin thread`, reopen the same thread menu, and verify it now shows `Unpin thread`
6. Verify projects with no visible threads do not show a fixed `No threads` row
7. Switch to dark theme and repeat steps 1 through 6 with another disposable thread

#### Expected Results
- Pin and archive are available directly on hover without selecting the row
- Archive is the only direct destructive action on the row; deletion remains available from the context menu
- Confirming archive removes the correct thread immediately from the sidebar and clears any pinned state for that thread
- Pin/unpin is available from the thread context menu and updates the `Pinned` section immediately
- Delete icon, `Confirm` button, and context menu items are readable in both light theme and dark theme

#### Rollback/Cleanup
- Delete or unpin any disposable threads created only for this test

---
