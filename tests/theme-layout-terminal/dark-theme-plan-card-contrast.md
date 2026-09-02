### Dark theme plan card contrast

#### Feature/Change Name
Plan cards use a neutral, theme-aware surface in both themes, including execute and revision actions.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`
2. A thread contains a visible plan card
3. Appearance is set to `Dark`

#### Steps
1. Open a thread containing a plan card in dark mode
2. Inspect the card background, title, explanation text, headings, lists, inline code, and blockquote styling
3. Verify the `执行计划` button and revision input are readable and visually distinct
4. Hover/focus the controls and confirm their states remain visible
5. Toggle to Light and repeat the same checks

#### Expected Results
- The plan card surface is distinguishable from the page background without using a blue-only or dark-only treatment
- Plan text and headings stay readable in dark mode
- Inline code, file links, and blockquotes keep enough contrast to scan comfortably
- Execute, revision, focus, placeholder, and disabled-submit states remain readable in both themes

#### Rollback/Cleanup
- Reset appearance to the previous user preference

---
