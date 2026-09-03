### Feature: Thread summary panel layout and visibility

#### Prerequisites
- App is running from this repository at a desktop viewport of at least 1200px wide.
- Open a thread with repository information and at least one persisted message.
- Test in both light and dark themes.

#### Steps
1. Open the thread and confirm the summary panel is visible in a dedicated right-side column.
2. Confirm the conversation and composer occupy the remaining left-side workspace without being covered by the summary.
3. Select the close icon in the summary header.
4. Confirm the summary disappears, a compact show-summary icon appears, and the conversation/composer return to centered alignment across the full content area.
5. Select the show-summary icon and confirm the right-side column returns.
6. Refresh the page and confirm the last open/hidden summary state is preserved.
7. Repeat the open, hide, and reopen flow in dark theme.
8. At a mobile viewport, confirm the desktop summary panel is not rendered.
9. In the environment section, confirm added and removed line counts use distinct green and red text colors.
10. Select the local, branch, and commit rows and confirm they open the local browser, branch chooser, and existing Git menu respectively.
11. In the branch chooser, search for a branch and select a different branch; confirm the selected branch and busy/error state follow the existing checkout flow.
12. In the sources section, select a file, image, web link, or skill/text reference and confirm each opens its corresponding local or external target in a new tab.

#### Expected Results
- Opening the summary creates a stable two-column desktop layout with the summary on the right.
- The summary never overlays message content or the composer.
- Hiding the summary restores the original centered single-column chat layout.
- Both toggle controls have accessible labels and preserve the selected state across refreshes.
- Light and dark themes use matching surfaces, borders, text colors, and hover states.
- Mobile retains the existing chat layout without the summary panel.
- Change counts remain visually distinguishable and summary actions reuse the existing local, branch, review, and Git workflows.
- Every displayed source is an accessible link with a useful label and target.

#### Rollback/Cleanup
- Restore the preferred summary visibility and appearance settings.
