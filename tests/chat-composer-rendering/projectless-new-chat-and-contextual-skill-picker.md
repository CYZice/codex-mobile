# Projectless new chat, plugin menu, and `$` skills

## Prerequisites

- Start codexapp with an available Codex app-server.
- Have at least one installed, enabled plugin and one installed skill.
- Open the home route with no local project selected.

## Steps

1. Send a first message without selecting a project.
2. Confirm that the new thread is listed as a projectless chat in Codex clients and that no `Documents/Codex/<date>/new-chat` directory was created.
3. Return to the home route and open the composer `+` menu. Confirm it opens upward above the message box and lists attachments plus enabled plugins; it must not contain a separate skill control.
4. Select an enabled plugin and confirm its default prompt, or a clear plugin-use instruction, appears in the draft.
5. In a fresh draft, type `$` followed by part of a skill name. Choose a skill with the mouse or arrow keys and Enter.
6. Send the message and inspect the user turn. In a later draft, remove the skill chip before sending.

## Expected results

- The first message creates a durable native Codex thread with no forced `cwd`; no new working directory is created.
- The selected plugin stays in the `+` menu; skills are not rendered as a standalone control.
- Typing `$` opens the matching-skills panel directly above the message field. Selecting one inserts its `$skill-name` marker and adds a removable composer chip that travels with the submitted turn.
- The model and permission controls have no separate skills picker.
- A removed skill is absent from the next submitted turn.

## Rollback and cleanup

- Remove the temporary test thread from the Codex client if it is no longer needed.
- No project folder needs deletion for the projectless-chat test.
