### Generated chats do not register as Projects

Run against an isolated test profile. Do not delete existing chat folders or session history.

1. In light mode create a Chat without project, send a short message, and check Chats and Projects in both folder-grouped and chronological modes.
2. Leave the thread running briefly and refresh the thread list; verify its generated `Documents/Codex/YYYY-MM-DD/<slug>` directory is not registered as a project.
3. Restart the UI, then inspect an existing chat whose generated folder was historically registered as a project. Check that the chat is still reachable under Chats and its old project placeholder is not visible.
4. Create a real project with a similarly named folder elsewhere. Verify its threads remain under Projects.
5. Repeat in dark mode, narrow/mobile viewport, and with sidebar search; check pinned chat behavior too.

Expected: the Chats and Projects sections remain disjoint in both sorting modes. Existing chat files and history remain intact. Persisting the project list removes only generated chat project registrations, not the underlying directories.
