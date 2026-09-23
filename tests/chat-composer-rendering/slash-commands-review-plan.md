### Slash command picker, review scope, and plan execution context

1. In light and dark themes, on desktop and a 375px mobile viewport, type `/` in a project thread and navigate with arrows, Enter, Tab, and pointer/touch. Verify `/plan`, `/review`, `/compact`, `/fork`, `/status`, `/fast` and `/goal` appear; unknown slash text stays ordinary draft text.
2. Select `/review`. Verify the picker offers **Uncommitted changes**, **Compare against branch** (choose a real branch, including a remote), and **Review a commit** (valid SHA). Verify each dispatches its selected native review target, never silently substitutes uncommitted changes, and blocks duplicate requests while pending. Cancel and verify the draft remains usable.
3. In a Plan-mode thread, complete a plan. Select **执行计划（保留上下文）** and verify execution resumes in the same thread; with another plan select **在新对话中执行（清空上下文）** and verify the new thread receives the full plan and original working directory while old thread/history remains intact.
4. Run `/compact` and check Codex reports native context compaction; it does not clear the entire conversation or create a fresh thread. Use `/fork` and verify a separate thread is created. Use `/status` and verify thread/model/context information comes from current state. If Fast is unavailable, its command must not silently enable it.
5. Test non-Git and new-chat contexts, invalid commit SHA, an active turn, switching threads while review selection is open, and a failed review request. No ghost review or cross-thread action should be submitted.

Expected: keyboard/touch controls, validation, errors, and disabled states are legible in both themes and narrow screens; the right-side Summary panel and its launcher remain absent.
