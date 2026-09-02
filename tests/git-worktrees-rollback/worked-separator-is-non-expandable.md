### Feature: Worked separator collapses complete turn activity

#### Prerequisites
- App server running from this repository.
- A thread with at least one `Worked for ...` separator.

#### Steps
1. Open a completed thread and locate a `Worked for ...` message above its final assistant summary.
2. Verify the plan, commands, and changed-files rows for that turn are initially hidden.
3. Click the separator line/text area.
4. Verify all activity rows for that turn appear above the separator and the final assistant summary remains visible.
5. Click the separator again and refresh the page.

#### Expected Results
- `Worked for ...` toggles the complete activity history for its turn.
- The final assistant summary is never hidden by the toggle.
- The collapsed choice remains after refresh.

#### Rollback/Cleanup
- No cleanup required.
