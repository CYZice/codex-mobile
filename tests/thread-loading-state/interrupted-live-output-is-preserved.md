### Feature: Preserve streamed output after an interrupted turn

#### Prerequisites

- Run Codex Mobile from this repository.
- Open a thread that can stream an assistant response and then become interrupted before its final answer is persisted.

#### Steps

1. Start a response and wait until visible assistant text has streamed into the conversation.
2. Interrupt the turn through an input-request interruption or the runtime's interrupted-turn path.
3. Confirm the streamed text remains visible instead of disappearing after the thread refreshes.
4. Confirm the notice reads `任务在等待输入时中断，已保留当前输出。` and offers `继续`.
5. Click `继续` and confirm a new follow-up turn starts with a request to complete the prior answer without repeating completed operations.
6. Wait for the new final answer, then refresh the browser.

#### Expected Results

- Interrupted live text remains visible until matching persisted history replaces it.
- The interruption is explicit; it is not displayed as a normal completed response.
- Continue does not resend the original user request or automatically replay commands.
- After the follow-up final answer persists, refreshing keeps both the preserved output and final answer visible.

#### Rollback/Cleanup

- Use a disposable thread for this check. No automatic retry or duplicate command execution occurs.
