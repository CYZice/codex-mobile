### Feature: Edit projects with multiple source folders and move chats

#### Prerequisites / setup

- Run the app with at least two existing local project folders and two chats.
- Keep one folder writable and ensure the sidebar shows both projects.

#### Actions

1. Open a project's `…` menu and choose `Edit project`.
2. Change the project name, choose `Add folder`, enter a second existing folder path, and save.
3. Reopen the editor and confirm both source folders and the saved name are present.
4. Open a chat's `…` menu, choose `Move to project`, and select the other project.
5. Refresh the page and confirm the chat remains under the selected project.

#### Expected results

- The editor lists every source folder, supports adding and removing folders, and persists the name and folder labels.
- Moving a chat updates its sidebar grouping immediately and persists across refreshes.
- The original chat content and working directory remain unchanged.

#### Rollback / cleanup

- Remove the added folder from the project editor or use `Remove local project` when the test project is disposable.
- Move the chat back to its original project if needed.
