import { describe, expect, it } from 'vitest'
import type { UiThread } from '../../types/codex'
import { getThreadActivityTimestamp, groupThreadsByActivityDate, isAttentionThread, sortThreadsByActivity } from './activityThreadGroups'

function thread(id: string, updatedAtIso: string, overrides: Partial<UiThread> = {}): UiThread {
  return {
    id,
    title: id,
    preview: '',
    cwd: `C:\\Projects\\${id}`,
    createdAtIso: updatedAtIso,
    updatedAtIso,
    unread: false,
    inProgress: false,
    ...overrides,
    projectName: overrides.projectName ?? id,
    hasWorktree: overrides.hasWorktree ?? false,
  }
}

describe('sidebar activity thread groups', () => {
  it('recognizes unread, running, and pending request threads as priority', () => {
    expect(isAttentionThread(thread('plain', '2026-08-30T10:00:00+08:00'))).toBe(false)
    expect(isAttentionThread(thread('unread', '2026-08-30T10:00:00+08:00', { unread: true }))).toBe(true)
    expect(isAttentionThread(thread('running', '2026-08-30T10:00:00+08:00', { inProgress: true }))).toBe(true)
    expect(isAttentionThread(thread('approval', '2026-08-30T10:00:00+08:00', { pendingRequestState: 'approval' }))).toBe(true)
  })

  it('sorts newest activity first and falls back to created time for invalid updates', () => {
    const rows = sortThreadsByActivity([
      thread('old', '2026-08-28T10:00:00+08:00'),
      thread('new', '2026-08-30T10:00:00+08:00'),
      thread('fallback', '', { createdAtIso: '2026-08-29T10:00:00+08:00' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['new', 'fallback', 'old'])
    expect(getThreadActivityTimestamp(thread('invalid', 'not-a-date'))).toBe(0)
  })

  it('groups remaining threads by local calendar day without duplicates', () => {
    const groups = groupThreadsByActivityDate([
      thread('today', '2026-08-30T08:00:00+08:00'),
      thread('yesterday', '2026-08-29T23:00:00+08:00'),
      thread('weekday', '2026-08-27T12:00:00+08:00'),
      thread('invalid', 'invalid'),
    ], {
      now: new Date('2026-08-30T21:00:00+08:00'),
      locale: 'en-US',
    })

    expect(groups[0]).toMatchObject({ key: 'today', label: 'Today' })
    expect(groups[1]).toMatchObject({ key: 'yesterday', label: 'Yesterday' })
    expect(groups[2].label).toBe('Thursday')
    expect(groups.at(-1)).toMatchObject({ key: 'earlier', label: 'Earlier' })
    expect(groups.flatMap((group) => group.threads.map((row) => row.id))).toEqual(['today', 'yesterday', 'weekday', 'invalid'])
  })
})
