### Composer expands long drafts to full screen

#### Feature/Change Name
Thread composer full-screen expand control for multi-line drafts.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev --host 127.0.0.1 --port 4173`)
2. Any existing thread is open and send controls are enabled
3. Light theme and dark theme both available from the appearance switcher

#### Steps
1. In light theme, type or paste at least six lines into the composer.
2. Confirm the expand button appears in the composer input area.
3. Click the expand button.
4. Confirm the composer fills the viewport, keeps the draft text, and leaves model/skill/thinking/send controls usable at the bottom.
5. Click the collapse button.
6. Confirm the composer returns to its normal inline size with the draft still intact.
7. Switch to dark theme and repeat steps 1-6.
8. Repeat at 375x812 and 768x1024 with enough text to scroll; verify the first and last lines are reachable.
9. Exit full screen with Escape on desktop and with the visible minimize button on each viewport.
10. Open an existing thread with the title, terminal, and branch toolbar visible; expand the composer and verify the full-screen surface covers that toolbar instead of rendering behind it.

#### Expected Results
- Short drafts do not show the expand control.
- Long or overflowing drafts show an icon-only expand control.
- Full-screen mode uses the same draft state and submit controls as inline mode.
- Full-screen mode covers the visual viewport without being clipped by the app shell; attachment chips scroll separately while the textarea and bottom controls remain usable.
- The minimize button stays visible above long content and the page behind the composer does not scroll.
- Existing-thread title and branch controls never cover the expanded composer or its first lines.
- Full-screen and inline states are readable in light theme and dark theme.

#### Rollback/Cleanup
- Clear the draft from the composer.

---
