### Feature: Preserve streamed output after an interrupted turn

#### Prerequisites

- Run Codex Mobile from this repository.
- Open a thread that can stream an assistant response and then become interrupted before its final answer is persisted.

#### Steps

1. Start a response and wait until visible assistant text has streamed into the conversation.
2. Interrupt the turn through an input-request interruption or the runtime's interrupted-turn path.
3. Confirm the streamed text remains visible instead of disappearing after the thread refreshes.
4. Confirm a compact neutral status row reads `已中断，输出已保留。` and offers `继续输入`.
5. Click `继续输入` and confirm no request is sent automatically; the composer receives focus for manual input.
6. Type and send a follow-up message, then wait for the new final answer and refresh the browser.

#### Expected Results

- Interrupted live text remains visible until matching persisted history replaces it.
- The interruption is explicit but uses a compact neutral status row instead of a large yellow banner.
- Continue does not send a canned prompt, resend the original user request, or automatically replay commands.
- After the manually entered follow-up final answer persists, refreshing keeps both the preserved output and final answer visible.

#### Rollback/Cleanup

- Use a disposable thread for this check. No automatic retry or duplicate command execution occurs.
