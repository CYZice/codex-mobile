# ChatGPT conversation reference menu

- The composer exposes ChatGPT conversation references from the `+` menu under a dedicated `ChatGPT conversations` group.
- The web bridge reads conversation summaries and individual conversations through the authenticated ChatGPT backend, but returns only normalized metadata and a bounded user/assistant preview to the browser.
- The composer marks inserted content as untrusted reference material and includes the conversation id/title so the assistant can distinguish it from current-user instructions.
- Loading is lazy when the `+` menu opens; failures are non-blocking and do not disable attachments, plugins, or `$` skills.
- Desktop permission capsules show the selected short label without the `Permission:` prefix.
- The in-progress send selector remains available through settings and is not rendered in the `+` menu.
