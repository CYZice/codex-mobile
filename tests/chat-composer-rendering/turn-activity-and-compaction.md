# Turn activity and automatic compaction

## Feature/Change Name

Codex-style compact activity rows for automatic context compaction, skill reads, and command execution.

## Prerequisites/Setup

1. Open a thread with an installed skill and enough context to trigger compaction.
2. Make light and dark themes available.

## Exact Actions

1. Start a turn that reads a skill and runs at least one command.
2. While the turn is active, confirm activity rows appear inline and the current activity is expanded.
3. After the final assistant summary appears, confirm `Worked for ...` is shown and the complete activity history above it is collapsed.
4. Click `Worked for ...`, confirm plans, compaction notices, commands, and changed-files activity for that turn appear; click it again to collapse them.
5. Refresh the thread after expanding a completed turn and confirm its expanded state persists.
6. Trigger or wait for automatic context compaction, then repeat in dark theme.

## Expected Results

- Skill reads are summarized as `Read <skill> skill` instead of exposing a long `SKILL.md` path.
- Consecutive commands are grouped under a compact summary and remain individually inspectable.
- Completed turns default to a collapsed activity history; the final assistant summary remains visible below `Worked for ...`.
- Expanding a completed turn reveals all of its activity records without affecting adjacent turns, and the user choice survives refresh.
- Automatic compaction renders as `Context automatically compacted` after the persisted thread data is reloaded.
- Activity rows do not expose Edit or Fork actions while the turn is responding or stop-pending.
- Light and dark surfaces remain readable.

## Rollback/Cleanup

- No persistent data needs to be removed; archive a disposable test thread if desired.
