# Codex Desktop ChatGPT conversation reference protocol

- Inspected on 2026-08-30 from installed Windows package `OpenAI.Codex_26.825.6671.0_x64__2p2nqsd0c76g0`, renderer bundle `webview/assets/app-initial-DJ_IF-Jc.js`.
- The Desktop composer is ProseMirror-based and represents a ChatGPT conversation reference as an inline atom node named `chatGptConversationMention`.
- The visible draft serializes a ChatGPT conversation reference as a Markdown link whose href starts with `chatgpt-conversation://`. Plugin references use `plugin://`.
- Submission parsing scans those Markdown links, deduplicates ChatGPT conversation ids, and constructs a bounded `priorConversation` preview.
- The bounded preview follows the selected conversation's `current_node` parent chain, includes user and completed assistant text, limits each content item to 2,000 characters, and starts from the third-latest user turn.
- Before submission, Desktop appends a section headed `## Referenced ChatGPT conversation:`. It labels the reference untrusted, includes JSON with `conversationId`, `title`, and `priorConversation`, and instructs the agent to call `read_thread` with the conversation id and `turnLimit: 10` when the preview is missing or insufficient.
- Common CDP ports 3434, 3435, 9222, and 9223 were unavailable for the already-running packaged app, so inspection used the installed renderer bundle without restarting the user's active Desktop session.
