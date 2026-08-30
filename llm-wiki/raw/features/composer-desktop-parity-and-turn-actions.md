# Composer Desktop parity and turn-action source facts

Date captured: 2026-08-30.

The reference behavior was supplied through Codex Desktop screenshots and direct product requirements. Local Codex Desktop CDP ports were unavailable during verification, so the screenshots are the parity fallback reference.

Implementation facts:

- Desktop composer controls are ordered as add, permissions, active plan mode, flexible space, context usage, model, and microphone/send.
- Permissions are not duplicated inside the add menu.
- Mobile retains its mobile-specific layout: permission and model capsules share one row above the input, add is left of the input, send appears only for sendable content, and context usage is hidden.
- The add and dollar-triggered skill menus use one shared composer surface, match the composer width, open above the input, have bounded height, and scroll vertically.
- Shared dark-theme rules cover menu surfaces, primary and secondary text, disabled rows, separators, selected rows, and segmented controls.
- A context-compaction item is normalized into a visible system activity row. Skill reads and command execution are grouped into collapsible activity.
- While a turn is running or a stop is not yet persisted, user-message editing and Fork are hidden. Fork becomes available only after normal completion or persisted interruption.
- Retry was removed; editing still rolls back and resends only when the edit is submitted.

Verification facts:

- Mobile 375x812 measured permission and model controls at the same y-coordinate and 36px height.
- Mobile add and skill menus measured 359px wide against a 359px composer shell and ended above the input.
- Dark-theme computed styles showed a zinc-800 menu surface, zinc-100 primary labels, zinc-400 secondary labels, and zinc-700 selected rows.
- Type checking, unit tests, frontend build, responsive light/dark screenshots, and browser runtime profiling are required before completion.
