import { describe, expect, it } from 'vitest'

import { normalizeThreadSummaryV2 } from './v2'

describe('project-aware thread normalization', () => {
  const thread = (id: string, cwd: string) => ({
    thread: { id, cwd, preview: '', turns: [], createdAt: 1, updatedAt: 1 },
  }) as never

  it('keeps an explicit null assignment out of cwd-based inference', () => {
    const result = normalizeThreadSummaryV2(thread('thread-a', 'C:/repo/src'), {
      localProjects: [{ id: 'project-a', name: 'Repo', rootPaths: ['C:/repo'] }],
      threadAssignments: { 'thread-a': null },
    })

    expect(result.projectId).toBeNull()
    expect(result.projectName).toBe('Chat without project')
  })

  it('allows same-named projects to remain distinct by id', () => {
    const first = normalizeThreadSummaryV2(thread('thread-a', 'C:/repo-a'), {
      localProjects: [{ id: 'project-a', name: 'Demo', rootPaths: ['C:/repo-a'] }, { id: 'project-b', name: 'Demo', rootPaths: ['C:/repo-b'] }],
      threadAssignments: {},
    })
    const second = normalizeThreadSummaryV2(thread('thread-b', 'C:/repo-b'), {
      localProjects: [{ id: 'project-a', name: 'Demo', rootPaths: ['C:/repo-a'] }, { id: 'project-b', name: 'Demo', rootPaths: ['C:/repo-b'] }],
      threadAssignments: {},
    })

    expect(first.projectId).toBe('project-a')
    expect(second.projectId).toBe('project-b')
  })
})
