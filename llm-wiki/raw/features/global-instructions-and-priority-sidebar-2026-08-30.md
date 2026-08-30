# Global instructions and priority sidebar source facts

## Global instructions settings

- Codex global instructions are stored at `CODEX_HOME/AGENTS.md`; a non-empty sibling `AGENTS.override.md` takes precedence.
- The Web settings route is `#/settings/personalization` and uses `GET`/`PUT /codex-api/global-instructions`.
- The response reports displayed path, resolved symbolic-link target, active override path, and effective source.
- Saving an `AGENTS.md` symbolic link writes to the link target so the skills-sync link remains intact.
- Empty content is valid. The UI warns beyond the default 32 KiB combined instruction budget but does not reject the save.
- Updated instructions apply to new Codex runs; an existing run does not rebuild its instruction chain.

## Sidebar activity view

- The existing Projects/Pinned/Chats tree remains the default.
- A bell beside sidebar Search toggles a locally persisted activity view.
- Priority includes threads that are unread, in progress, awaiting approval, or awaiting a response, sorted by latest activity.
- Remaining threads are de-duplicated and grouped in local time as Today, Yesterday, recent weekdays, then localized older dates.
- Search filtering and existing thread actions remain shared with the normal sidebar; no new network request is introduced by the view.

## ChatGPT conversation failure handling

- The composer keeps the ChatGPT conversation group visible on list failure, displays the server's network/auth detail, and provides an in-place Retry action.
- The production `5900` process must be restarted after rebuilding because an already-running Node process retains the previously loaded server bridge even when `dist-cli` changes on disk.
