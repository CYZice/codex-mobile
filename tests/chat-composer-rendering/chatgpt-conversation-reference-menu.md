# ChatGPT conversation reference menu

## Prerequisites / setup

- Run the web app with a valid Codex/ChatGPT login.
- Use a desktop viewport for the Desktop composer check; repeat the menu check on a 375×812 mobile viewport.

## Actions

1. Open a projectless chat and click `+`.
2. Confirm the menu is above the input, has a bounded scroll region, and is grouped as `Add`, `Plugins`, and `ChatGPT conversations` when conversation data is available.
3. Type ordinary text, add a space, then type `@` and continue with part of a plugin or conversation title. Confirm the same menu opens above the input and filters the unified results.
4. Select a ChatGPT conversation and confirm the `@query` token is replaced at the cursor by a compact, non-editable reference node inside the same editable paragraph. It must not render in a separate row above the editor.
5. Continue typing after the reference, add another space and `@query`, then select a plugin. Confirm repeated mentions work without removing the earlier reference or surrounding text.
6. Reload a persisted draft containing `[title](chatgpt-conversation://conversation-id)` and confirm it is restored as the same inline reference node.
7. Submit and confirm the visible draft keeps Desktop-compatible Markdown reference links while the outgoing text also includes the bounded, untrusted ChatGPT conversation context block.
8. Open `$` in the same composer and confirm its visual surface, width, scrolling, separators, and row states match the `+` menu.
9. Repeat in dark mode and on mobile.

## Expected results

- Desktop permission capsule is beside `+` and shows only the selected preset label (for example, `Auto-review`), without a `Permission:` prefix.
- The `+` menu does not contain the in-progress send mode selector.
- ChatGPT conversation rows are loaded lazily and selecting one never injects the full remote transcript into the browser; only the bounded preview is included when the message is submitted.
- `@` opens the same composer menu as `+`, with unified filtering across add actions, plugins, ChatGPT conversations, and files.
- `@` may be triggered at the start of the editor or after whitespace in an existing sentence, and may be triggered repeatedly in one draft.
- ChatGPT and plugin selections remain inline in the editable document. Long labels may wrap naturally on mobile but must stay in the same paragraph and cursor flow.
- ChatGPT references serialize as `[title](chatgpt-conversation://conversation-id)`; plugin references serialize with the `plugin://` prefix.
- The ChatGPT context block contains at most the latest three user-turn branches, limits each text item to 2,000 characters, and instructs the agent to call `read_thread` when more context is needed.
- Unauthenticated or unavailable ChatGPT data leaves the composer usable and does not block attachments, plugins, or skills.
- Mobile keeps the original permission/model-above-input layout and hides the context ring.

## Rollback / cleanup

- Close the menu with Escape or by clicking outside.
- Delete the inline reference node from the draft before sending if the selection was only for inspection.
