# ChatGPT conversation reference menu

## Prerequisites / setup

- Run the web app with a valid Codex/ChatGPT login.
- Use a desktop viewport for the Desktop composer check; repeat the menu check on a 375×812 mobile viewport.

## Actions

1. Open a projectless chat and click `+`.
2. Confirm the menu is above the input, has a bounded scroll region, and is grouped as `Add`, `Plugins`, and `ChatGPT conversations` when conversation data is available.
3. Select a ChatGPT conversation.
4. Confirm the composer receives a bounded, clearly marked untrusted reference preview and the menu closes.
5. Open `$` in the same composer and confirm its visual surface, width, scrolling, separators, and row states match the `+` menu.
6. Repeat in dark mode and on mobile.

## Expected results

- Desktop permission capsule is beside `+` and shows only the selected preset label (for example, `Auto-review`), without a `Permission:` prefix.
- The `+` menu does not contain the in-progress send mode selector.
- ChatGPT conversation rows are loaded lazily and selecting one never injects the full remote transcript into the browser; only the bounded preview is inserted into the draft.
- Unauthenticated or unavailable ChatGPT data leaves the composer usable and does not block attachments, plugins, or skills.
- Mobile keeps the original permission/model-above-input layout and hides the context ring.

## Rollback / cleanup

- Close the menu with Escape or by clicking outside.
- Remove the inserted reference text from the draft before sending if the selection was only for inspection.
