# Concept: Composer Desktop parity and responsive behavior

## Scope

Codex Desktop is the behavioral reference for the desktop composer, while mobile deliberately keeps a compact responsive layout instead of copying the desktop footer literally.

Source: [Composer Desktop parity and turn-action facts](../../raw/features/composer-desktop-parity-and-turn-actions.md).

## Desktop control order

The footer order is add, permissions, active plan mode, flexible space, context usage, model, and microphone/send. Permissions live beside add and never appear again inside the add menu.

## Mobile layout

Permission and model controls share the same top row and the same capsule geometry. Keeping both controls inside one flex row is important: separate grid rows use independent height and alignment calculations and make the permission control appear to float upward. The context ring remains hidden on mobile so it cannot squeeze the input or action controls.

## Shared menus

The add and dollar-triggered skill menus share a composer menu surface. Both menus:

- match the composer width
- open above rather than over the input
- use `max-height: min(28rem, calc(100dvh - 12rem))`
- scroll vertically with contained overscroll
- support light and dark surfaces, readable disabled states, visible separators, keyboard navigation, Escape, and outside-click dismissal

Dark-theme rules belong in the global stylesheet because component-scoped text utilities can otherwise override the dark menu surface and leave dark text on a dark background.

## Turn actions and activity

Context compaction is rendered as a system activity row. Skill reads and command execution are grouped into collapsible activity. User-message editing and Fork stay hidden while a turn is active or an interrupt is waiting to persist. Retry is not exposed.

## Verification

Responsive checks cover 375x812 mobile, 768x1024 tablet, and desktop light/dark layouts. Measure control geometry and menu bounds in addition to reviewing screenshots, then run unit tests, builds, and the browser/thread profile.
