# Turn activity and automatic compaction

## Feature/Change Name

Codex-style compact activity rows for automatic context compaction, skill reads, and command execution.

## Prerequisites/Setup

1. Open a thread with an installed skill and enough context to trigger compaction.
2. Make light and dark themes available.

## Exact Actions

1. Start a turn that reads a skill and runs at least one command.
2. While the turn is active, confirm activity rows appear inline and the current activity is expanded.
3. Confirm consecutive command rows can be expanded and collapsed as one group.
4. Trigger or wait for automatic context compaction, then refresh the thread after the turn settles.
5. Repeat in dark theme.

## Expected Results

- Skill reads are summarized as `Read <skill> skill` instead of exposing a long `SKILL.md` path.
- Consecutive commands are grouped under a compact summary and remain individually inspectable.
- Automatic compaction renders as `Context automatically compacted` after the persisted thread data is reloaded.
- Activity rows do not expose Edit or Fork actions while the turn is responding or stop-pending.
- Light and dark surfaces remain readable.

## Rollback/Cleanup

- No persistent data needs to be removed; archive a disposable test thread if desired.
