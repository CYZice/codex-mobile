import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildWorkspaceRootsProjectOrderState,
  collectWorkspaceRootPathsForProjectRemoval,
  filterGroupsByWorkspaceRoots,
  findAdjacentThreadId,
  mergeIncomingWithLocalInProgressThreads,
  removeThreadFromGroups,
  useDesktopState,
} from './useDesktopState'
import type { UiProjectGroup } from '../types/codex'
import type { AvailableModel, WorkspaceRootsState } from '../api/codexGateway'
import { buildChatGptConversationReferenceBlock } from '../composerReferences'

const gatewayMocks = vi.hoisted(() => ({
  archiveThread: vi.fn(),
  forkThread: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAvailableCollaborationModes: vi.fn(),
  getAvailableModels: vi.fn(),
  getCurrentModelConfig: vi.fn(),
  getPendingServerRequests: vi.fn(),
  getPermissionState: vi.fn(),
  getSkillsList: vi.fn(),
  getThreadDetail: vi.fn(),
  getThreadGroupsPage: vi.fn(),
  getThreadQueueState: vi.fn(),
  getThreadUnreadState: vi.fn(),
  getThreadTitleCache: vi.fn(),
  getWorkspaceRootsState: vi.fn(),
  removeWorkspaceRootPaths: vi.fn(),
  renameWorkspaceRootPaths: vi.fn(),
  interruptThreadTurn: vi.fn(),
  persistThreadTitle: vi.fn(),
  renameThread: vi.fn(),
  replyToServerRequest: vi.fn(),
  resumeThread: vi.fn(),
  revertThreadFileChanges: vi.fn(),
  rollbackThread: vi.fn(),
  setCodexSpeedMode: vi.fn(),
  setPermissionState: vi.fn(),
  setThreadQueueState: vi.fn(),
  setThreadUnreadState: vi.fn(),
  setWorkspaceProjectOrder: vi.fn(),
  startThread: vi.fn(),
  startThreadTurn: vi.fn(),
  steerThreadTurn: vi.fn(),
  subscribeCodexNotifications: vi.fn(),
}))

vi.mock('../api/codexGateway', () => ({
  ...gatewayMocks,
  getBackgroundThreadListLimit: vi.fn(() => 100),
  pickCodexRateLimitSnapshot: vi.fn(() => null),
}))

function thread(id: string, cwd: string, options: { hasWorktree?: boolean } = {}) {
  return {
    id,
    title: id,
    projectName: cwd ? cwd.split('/').at(-1) || cwd : 'Projectless',
    cwd,
    hasWorktree: options.hasWorktree ?? false,
    createdAtIso: '2026-04-28T00:00:00.000Z',
    updatedAtIso: '2026-04-28T00:00:00.000Z',
    preview: '',
    unread: false,
    inProgress: false,
  }
}

function modelsWithoutReasoning(...ids: string[]): AvailableModel[] {
  return ids.map((id) => ({
    id,
    displayName: id.replace(/^gpt/i, 'GPT'),
    hidden: false,
    isDefault: false,
    upgrade: null,
    supportedReasoningEfforts: null,
    defaultReasoningEffort: null,
  }))
}

function installTestWindow(initialStorage: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialStorage))
  vi.stubGlobal('window', {
    localStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
      }),
    },
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  gatewayMocks.getThreadQueueState.mockResolvedValue({})
  gatewayMocks.getThreadTitleCache.mockResolvedValue({ titles: {} })
  gatewayMocks.getPermissionState.mockResolvedValue({ defaultPreset: 'workspace', threadPresets: {} })
  gatewayMocks.setPermissionState.mockResolvedValue(undefined)
  gatewayMocks.getWorkspaceRootsState.mockRejectedValue(new Error('no workspace roots state'))
  gatewayMocks.getThreadUnreadState.mockResolvedValue({ threadIds: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Codex memory compatibility', () => {
  it('removes legacy browser-only per-thread memory overrides', () => {
    installTestWindow({
      'codex-web-local.thread-memory.v1': JSON.stringify({
        'thread-old': { useMemories: false, generateMemories: false },
      }),
    })

    useDesktopState()

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('codex-web-local.thread-memory.v1')
  })
})

describe('filterGroupsByWorkspaceRoots', () => {
  it('keeps projectless chats visible when workspace roots are configured', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'Projectless',
        threads: [thread('projectless-chat', '')],
      },
      {
        projectName: 'allowed-project',
        threads: [thread('allowed-chat', '/tmp/allowed-project')],
      },
      {
        projectName: 'other-project',
        threads: [thread('other-chat', '/tmp/other-project')],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/allowed-project'],
      labels: {},
      active: ['/tmp/allowed-project'],
      projectOrder: [],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => group.projectName)).toEqual([
      'Projectless',
      'allowed-project',
    ])
  })

  it('keeps workspace roots with the same folder name as separate projects', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'api',
        threads: [
          thread('first-api-chat', '/tmp/first/api'),
          thread('second-api-chat', '/tmp/second/api'),
        ],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/first/api', '/tmp/second/api'],
      labels: {},
      active: ['/tmp/first/api', '/tmp/second/api'],
      projectOrder: [],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => group.projectName)).toEqual([
      '/tmp/first/api',
      '/tmp/second/api',
    ])
  })

  it('uses Codex project-order when workspace roots are hydrated', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'alpha',
        threads: [thread('alpha-chat', '/tmp/alpha')],
      },
      {
        projectName: 'beta',
        threads: [thread('beta-chat', '/tmp/beta')],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/alpha', '/tmp/beta'],
      labels: {},
      active: ['/tmp/alpha'],
      projectOrder: ['/tmp/beta', '/tmp/alpha'],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => group.projectName)).toEqual([
      'beta',
      'alpha',
    ])
  })

  it('keeps empty duplicate workspace roots visible in Codex project order', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'TestChat',
        threads: [thread('testchat-chat', '/Users/igor/temp/TestChat')],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/Users/igor/Documents/New project 2/TestChat', '/Users/igor/temp/TestChat'],
      labels: {},
      active: ['/Users/igor/Documents/New project 2/TestChat', '/Users/igor/temp/TestChat'],
      projectOrder: ['/Users/igor/Documents/New project 2/TestChat', '/Users/igor/temp/TestChat'],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => [group.projectName, group.threads.length])).toEqual([
      ['/Users/igor/Documents/New project 2/TestChat', 0],
      ['/Users/igor/temp/TestChat', 1],
    ])
  })

  it('keeps remote projects from Codex project order visible as empty project rows', () => {
    const groups: UiProjectGroup[] = []
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/local-project'],
      labels: {},
      active: ['/tmp/local-project'],
      projectOrder: ['remote-project-id', '/tmp/local-project'],
      remoteProjects: [{
        id: 'remote-project-id',
        hostId: 'remote-ssh-discovered:a1',
        remotePath: '/home/ubuntu',
        label: 'ubuntu',
      }],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => [group.projectName, group.threads.length])).toEqual([
      ['remote-project-id', 0],
      ['local-project', 0],
    ])
  })

  it('keeps managed worktree threads under the matching workspace root project', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'codex-web-local',
        threads: [
          thread('main-chat', '/Users/igor/Git-projects/codex-web-local'),
          thread('worktree-chat', '/Users/igor/.codex/worktrees/53e7/codex-web-local', { hasWorktree: true }),
        ],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/Users/igor/Git-projects/codex-web-local'],
      labels: {},
      active: ['/Users/igor/Git-projects/codex-web-local'],
      projectOrder: ['/Users/igor/Git-projects/codex-web-local'],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => [group.projectName, group.threads.map((row) => row.id)])).toEqual([
      ['codex-web-local', ['main-chat', 'worktree-chat']],
    ])
  })

  it('keeps unregistered managed worktrees under the main root when another managed worktree root is registered', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'codex-web-local',
        threads: [
          thread('main-chat', '/Users/igor/Git-projects/codex-web-local'),
          thread('registered-worktree-chat', '/Users/igor/.codex/worktrees/a77f/codex-web-local', { hasWorktree: true }),
          thread('unregistered-worktree-chat', '/Users/igor/.codex/worktrees/53e7/codex-web-local', { hasWorktree: true }),
        ],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: [
        '/Users/igor/Git-projects/codex-web-local',
        '/Users/igor/.codex/worktrees/a77f/codex-web-local',
      ],
      labels: {
        '/Users/igor/.codex/worktrees/a77f/codex-web-local': 'codex-web-local2',
      },
      active: ['/Users/igor/Git-projects/codex-web-local'],
      projectOrder: ['/Users/igor/Git-projects/codex-web-local'],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => [group.projectName, group.threads.map((row) => row.id)])).toEqual([
      ['/Users/igor/Git-projects/codex-web-local', ['main-chat', 'unregistered-worktree-chat']],
      ['/Users/igor/.codex/worktrees/a77f/codex-web-local', ['registered-worktree-chat']],
    ])
  })

  it('does not group unrelated git worktrees under a same-leaf workspace root project', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'codex-web-local',
        threads: [
          thread('main-chat', '/Users/igor/Git-projects/codex-web-local'),
          thread('other-git-worktree-chat', '/tmp/other/.git/worktrees/codex-web-local', { hasWorktree: true }),
        ],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/Users/igor/Git-projects/codex-web-local'],
      labels: {},
      active: ['/Users/igor/Git-projects/codex-web-local'],
      projectOrder: ['/Users/igor/Git-projects/codex-web-local'],
    }

    expect(filterGroupsByWorkspaceRoots(groups, rootsState).map((group) => [group.projectName, group.threads.map((row) => row.id)])).toEqual([
      ['/Users/igor/Git-projects/codex-web-local', ['main-chat']],
    ])
  })
})

describe('removeThreadFromGroups', () => {
  it('removes an archived thread and drops the now-empty project group', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'alpha',
        threads: [thread('keep-alpha', '/tmp/alpha')],
      },
      {
        projectName: 'archived-project',
        threads: [thread('archive-me', '/tmp/archived-project')],
      },
      {
        projectName: 'beta',
        threads: [thread('keep-beta', '/tmp/beta')],
      },
      {
        projectName: 'empty-workspace-root',
        threads: [],
      },
    ]

    expect(removeThreadFromGroups(groups, 'archive-me').map((group) => [
      group.projectName,
      group.threads.map((row) => row.id),
    ])).toEqual([
      ['alpha', ['keep-alpha']],
      ['beta', ['keep-beta']],
      ['empty-workspace-root', []],
    ])
  })

  it('preserves referential identity when the thread is absent', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'alpha',
        threads: [thread('keep-alpha', '/tmp/alpha')],
      },
    ]

    expect(removeThreadFromGroups(groups, 'missing-thread')).toBe(groups)
  })
})

describe('workspace roots project persistence helpers', () => {
  it('collects duplicate-path project roots by full path when removing a project', () => {
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/first/api', '/tmp/second/api'],
      labels: {
        '/tmp/first/api': 'First API',
        '/tmp/second/api': 'Second API',
      },
      active: ['/tmp/first/api'],
      projectOrder: ['/tmp/first/api', '/tmp/second/api'],
    }

    expect([...collectWorkspaceRootPathsForProjectRemoval(rootsState, '/tmp/first/api')]).toEqual([
      '/tmp/first/api',
    ])
  })

  it('preserves remote project ids in explicit project order when persisting workspace roots', () => {
    const groups: UiProjectGroup[] = [
      {
        projectName: 'local-project',
        threads: [thread('local-chat', '/tmp/local-project')],
      },
    ]
    const rootsState: WorkspaceRootsState = {
      order: ['/tmp/local-project'],
      labels: {},
      active: ['/tmp/local-project'],
      projectOrder: ['remote-project-id', '/tmp/local-project'],
      remoteProjects: [{
        id: 'remote-project-id',
        hostId: 'remote-ssh-discovered:a1',
        remotePath: '/home/ubuntu',
        label: 'ubuntu',
      }],
    }

    expect(buildWorkspaceRootsProjectOrderState(rootsState, ['remote-project-id', 'local-project'], groups)).toEqual({
      order: ['/tmp/local-project'],
      active: ['/tmp/local-project'],
      projectOrder: ['remote-project-id', '/tmp/local-project'],
    })
  })
})

describe('thread unread state', () => {
  it('uses the shared unread state instead of a local timestamp cutoff', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('read', '/tmp/project'), thread('unread', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getThreadUnreadState.mockResolvedValue({ threadIds: ['unread'] })

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false })

    expect(state.projectGroups.value[0]?.threads.find((item) => item.id === 'read')?.unread).toBe(false)
    expect(state.projectGroups.value[0]?.threads.find((item) => item.id === 'unread')?.unread).toBe(true)
  })
})

describe('collaboration mode selection', () => {
  it('can prime an empty selected thread without clearing persisted selection', () => {
    installTestWindow({
      'codex-web-local.selected-thread-id.v1': 'thread-a',
    })

    const state = useDesktopState()

    expect(state.selectedThreadId.value).toBe('thread-a')

    state.primeSelectedThread('', { persist: false })

    expect(state.selectedThreadId.value).toBe('')
    expect(window.localStorage.getItem('codex-web-local.selected-thread-id.v1')).toBe('thread-a')
  })

  it('does not carry plan mode from new chats into existing threads', () => {
    installTestWindow({
      'codex-web-local.collaboration-mode.v1': 'plan',
    })

    const state = useDesktopState()

    expect(state.selectedCollaborationMode.value).toBe('default')

    state.setSelectedCollaborationMode('plan')

    expect(state.selectedCollaborationMode.value).toBe('plan')
    expect(window.localStorage.getItem('codex-web-local.collaboration-mode-by-context.v1')).toBe(null)

    state.primeSelectedThread('thread-a')

    expect(state.selectedCollaborationMode.value).toBe('default')

    state.setSelectedCollaborationMode('plan')
    state.primeSelectedThread('thread-b')

    expect(state.selectedCollaborationMode.value).toBe('default')

    state.primeSelectedThread('thread-a')

    expect(state.selectedCollaborationMode.value).toBe('plan')
  })
})

describe('Codex CLI availability', () => {
  it('surfaces a chat runtime error when the app-server bridge cannot find Codex CLI', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockRejectedValue(new Error('Codex CLI is not available. Install @openai/codex or set CODEXUI_CODEX_COMMAND.'))

    const state = useDesktopState()

    await state.refreshAll({ awaitAncillaryRefreshes: true })

    expect(state.codexCliMissingError.value).toBe('Codex CLI not found. Install @openai/codex or set CODEXUI_CODEX_COMMAND.')
  })

  it('clears a previous Codex CLI missing banner when a later refresh fails for another reason', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage
      .mockRejectedValueOnce(new Error('Codex CLI is not available. Install @openai/codex or set CODEXUI_CODEX_COMMAND.'))
      .mockRejectedValueOnce(new Error('Connection lost'))

    const state = useDesktopState()

    await state.refreshAll({ awaitAncillaryRefreshes: true })
    expect(state.codexCliMissingError.value).toBe('Codex CLI not found. Install @openai/codex or set CODEXUI_CODEX_COMMAND.')

    await state.refreshAll({ awaitAncillaryRefreshes: true })
    expect(state.error.value).toBe('Connection lost')
    expect(state.codexCliMissingError.value).toBe('')
  })

})

describe('startup request deduplication', () => {
  it('reloads cached thread titles on forced thread refresh', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('thread-1', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getThreadTitleCache
      .mockResolvedValueOnce({ titles: {} })
      .mockResolvedValueOnce({ titles: { 'thread-1': 'Imported title' } })

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false })
    expect(state.projectGroups.value[0]?.threads[0]?.title).toBe('thread-1')

    await state.refreshAll({ includeSelectedThreadMessages: false, forceThreadRefresh: true })

    expect(gatewayMocks.getThreadTitleCache).toHaveBeenCalledTimes(2)
    expect(state.projectGroups.value[0]?.threads[0]?.title).toBe('Imported title')
  })

  it('reuses a just-loaded thread list during startup refresh bursts', async () => {
    installTestWindow()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('thread-1', '/tmp/project')] }],
      nextCursor: null,
    })

    try {
      const state = useDesktopState()
      await state.refreshAll({ includeSelectedThreadMessages: false })
      await state.refreshAll({ includeSelectedThreadMessages: false })

      expect(gatewayMocks.getThreadGroupsPage).toHaveBeenCalledTimes(1)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('reuses a just-loaded skills list for the same selected cwd', async () => {
    installTestWindow()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('thread-1', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([
      {
        name: 'example',
        description: 'Example skill',
        path: '/tmp/project/.agents/skills/example/SKILL.md',
        scope: 'project',
        enabled: true,
      },
    ])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5'))

    try {
      const state = useDesktopState()
      state.primeSelectedThread('thread-1')
      await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
      await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

      expect(gatewayMocks.getSkillsList).toHaveBeenCalledTimes(1)
      expect(gatewayMocks.getSkillsList).toHaveBeenCalledWith(['/tmp/project'], { forceReload: false })
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('reuses a just-loaded empty skills list for the same selected cwd', async () => {
    installTestWindow()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('thread-1', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5'))

    try {
      const state = useDesktopState()
      state.primeSelectedThread('thread-1')
      await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
      await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

      expect(gatewayMocks.getSkillsList).toHaveBeenCalledTimes(1)
      expect(state.installedSkills.value).toEqual([])
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('bypasses recent thread-list reuse for event-driven thread refreshes', async () => {
    installTestWindow()
    vi.mocked(window.setTimeout).mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        void Promise.resolve().then(() => callback())
      }
      return 1
    }) as typeof window.setTimeout)
    let notificationHandler: ((notification: { method: string; params?: unknown }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notificationHandler = handler as typeof notificationHandler
      return vi.fn()
    })
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('thread-1', '/tmp/project')] }],
      nextCursor: null,
    })

    try {
      const state = useDesktopState()
      await state.refreshAll({ includeSelectedThreadMessages: false })
      const callsBeforeNotification = gatewayMocks.getThreadGroupsPage.mock.calls.length
      state.startPolling()
      expect(notificationHandler).toBeDefined()
      notificationHandler!({
        method: 'thread/name/updated',
        params: {
          threadId: 'thread-1',
          threadName: 'Updated title',
        },
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(gatewayMocks.getThreadGroupsPage.mock.calls.length).toBeGreaterThan(callsBeforeNotification)
    } finally {
      nowSpy.mockRestore()
    }
  })
})

describe('upstream model reroute notifications', () => {
  it('shows only response.model from the matching turn and counts distinct responses', () => {
    installTestWindow()
    gatewayMocks.setThreadUnreadState.mockResolvedValue(undefined)
    let notify: ((notification: { method: string; params: unknown; atIso: string }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notify = handler
      return vi.fn()
    })
    const state = useDesktopState()
    state.startPolling()
    const send = (method: string, params: unknown) => notify!({ method, params, atIso: '2026-09-21T00:00:00Z' })
    const report = (threadId: string, turnId: string, model: string, responseId: string, phase = 'created') =>
      send('codexMobile/upstreamModelReported', { threadId, turnId, model, responseId, phase })

    send('turn/started', { threadId: 'thread-a', turn: { id: 'turn-1' } })
    report('thread-b', 'turn-1', 'other-thread-model', 'resp_other')
    report('thread-a', 'old-turn', 'old-model', 'resp_old')
    expect(state.upstreamModelByThreadId.value['thread-a']).toBeUndefined()
    report('thread-a', 'turn-1', 'gpt-5.6-terra', 'resp_1')
    expect(state.upstreamModelByThreadId.value['thread-a']).toMatchObject({
      model: 'gpt-5.6-terra', turnId: 'turn-1', responseCount: 1,
    })
    report('thread-a', 'turn-1', 'gpt-5.6-terra', 'resp_1', 'completed')
    expect(state.upstreamModelByThreadId.value['thread-a']?.responseCount).toBe(1)
    report('thread-a', 'turn-1', 'gpt-5.6-sol', 'resp_2')
    expect(state.upstreamModelByThreadId.value['thread-a']).toMatchObject({
      model: 'gpt-5.6-sol', responseCount: 2,
    })
    send('turn/completed', { threadId: 'thread-a', turn: { id: 'turn-1', status: 'completed' } })
    expect(state.upstreamModelByThreadId.value['thread-a']?.model).toBe('gpt-5.6-sol')
    send('turn/started', { threadId: 'thread-a', turn: { id: 'turn-2' } })
    expect(state.upstreamModelByThreadId.value['thread-a']).toBeUndefined()
    report('thread-a', 'turn-1', 'stale-model', 'resp_3')
    expect(state.upstreamModelByThreadId.value['thread-a']).toBeUndefined()
    report('thread-a', 'turn-2', 'gpt-5.6-terra', 'resp_4')
    send('ready', { ok: true })
    expect(state.upstreamModelByThreadId.value['thread-a']).toBeUndefined()
    expect(gatewayMocks.startThreadTurn).not.toHaveBeenCalled()
  })

  it('keeps only explicit per-turn reports and never sends another model request', () => {
    installTestWindow()
    gatewayMocks.setThreadUnreadState.mockResolvedValue(undefined)
    let notify: ((notification: { method: string; params: unknown; atIso: string }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notify = handler
      return vi.fn()
    })

    const state = useDesktopState()
    state.setSelectedModelIdForThread('thread-a', 'gpt-6-astra')
    state.setSelectedModelIdForThread('thread-b', 'gpt-6-astra')
    state.startPolling()
    const send = (method: string, params: unknown) => notify!({ method, params, atIso: '2026-09-17T00:00:00Z' })

    send('ready', { ok: true })
    send('turn/started', { threadId: 'thread-a', turn: { id: 'turn-1' } })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
    send('thread/settings/updated', { threadId: 'thread-a', threadSettings: { model: 'gpt-5.6-sol' } })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
    send('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
      reason: 'highRiskCyberActivity',
    })
    expect(state.modelRerouteByThreadId.value['thread-a']).toMatchObject({
      fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol', turnId: 'turn-1',
    })
    expect(state.modelRerouteByThreadId.value['thread-b']).toBeUndefined()

    send('turn/started', { threadId: 'thread-a', turn: { id: 'turn-2' } })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
    send('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
    })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
    send('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-2', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
    })
    send('turn/completed', { threadId: 'thread-a', turn: { id: 'turn-2', status: 'completed' } })
    expect(state.modelRerouteByThreadId.value['thread-a']?.turnId).toBe('turn-2')
    send('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra', toModel: 'gpt-reserve',
    })
    expect(state.modelRerouteByThreadId.value['thread-a']?.toModel).toBe('gpt-5.6-sol')

    state.setSelectedModelIdForThread('thread-a', 'gpt-5.6-sol')
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
    expect(gatewayMocks.startThreadTurn).not.toHaveBeenCalled()
    expect(gatewayMocks.startThread).not.toHaveBeenCalled()
    expect(gatewayMocks.getAvailableModels).not.toHaveBeenCalled()
  })

  it('drops a prior report on reconnect instead of assuming it still applies', () => {
    installTestWindow()
    let notify: ((notification: { method: string; params: unknown; atIso: string }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notify = handler
      return vi.fn()
    })
    const state = useDesktopState()
    state.startPolling()
    const send = (method: string, params: unknown) => notify!({ method, params, atIso: '2026-09-17T00:00:00Z' })
    send('turn/started', { threadId: 'thread-a', turn: { id: 'turn-1' } })
    send('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
    })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeDefined()
    send('ready', { ok: true })
    expect(state.modelRerouteByThreadId.value['thread-a']).toBeUndefined()
  })
})

describe('forking from a completed response', () => {
  it('keeps a local fork visible until the server thread list includes it', () => {
    const source = thread('source-thread', '/tmp/project')
    const forked = thread('forked-thread', '/tmp/project')
    const merged = mergeIncomingWithLocalInProgressThreads(
      [{ projectName: 'project', threads: [forked, source] }],
      [{ projectName: 'project', threads: [source] }],
      {},
      new Set(['forked-thread']),
    )

    expect(merged[0]?.threads.map((item) => item.id)).toEqual(['forked-thread', 'source-thread'])
  })

  it('allows a historical fork while the source thread is streaming and removes newer turns from the child', async () => {
    installTestWindow()
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      messages: [
        { id: 'user-0', role: 'user', text: 'first request', messageType: 'userMessage', turnIndex: 0 },
        { id: 'assistant-0', role: 'assistant', text: 'first response', messageType: 'agentMessage', turnIndex: 0 },
      ],
      inProgress: true,
      activeTurnId: 'turn-1',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })
    gatewayMocks.forkThread.mockResolvedValue({
      threadId: 'forked-thread',
      cwd: '/tmp/project',
      model: 'gpt-5.5',
      messages: [
        { id: 'user-0', role: 'user', text: 'first request', messageType: 'userMessage', turnIndex: 0 },
        { id: 'assistant-0', role: 'assistant', text: 'first response', messageType: 'agentMessage', turnIndex: 0 },
        { id: 'user-1', role: 'user', text: 'second request', messageType: 'userMessage', turnIndex: 1 },
        { id: 'assistant-1', role: 'assistant', text: 'second response', messageType: 'agentMessage', turnIndex: 1 },
      ],
    })
    gatewayMocks.rollbackThread.mockResolvedValue([
      { id: 'user-0', role: 'user', text: 'first request', messageType: 'userMessage', turnIndex: 0 },
      { id: 'assistant-0', role: 'assistant', text: 'first response', messageType: 'agentMessage', turnIndex: 0 },
    ])

    const state = useDesktopState()
    state.primeSelectedThread('source-thread')
    await state.loadMessages('source-thread')

    await expect(state.forkThreadFromTurn('source-thread', 0)).resolves.toBe('forked-thread')

    expect(gatewayMocks.forkThread).toHaveBeenCalledWith('source-thread')
    expect(gatewayMocks.rollbackThread).toHaveBeenCalledWith('forked-thread', 1)
    expect(state.selectedThreadId.value).toBe('forked-thread')
    expect(state.messages.value.every((message) => message.turnIndex === undefined || message.turnIndex <= 0)).toBe(true)
  })
})

describe('live error overlay', () => {
  it('shows the default thinking overlay while a selected thread is in progress without activity events', async () => {
    installTestWindow()
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          text: 'create todo list app',
          messageType: 'userMessage',
        },
      ],
      inProgress: true,
      activeTurnId: 'turn-1',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-thinking')
    await state.loadMessages('thread-thinking')

    expect(state.selectedLiveOverlay.value).toMatchObject({
      activityLabel: 'Thinking',
      reasoningText: '',
      errorText: '',
    })
  })

  it('keeps streamed output visible when a turn is interrupted before it persists', async () => {
    installTestWindow()
    let notificationHandler: ((notification: { method: string; params: unknown }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notificationHandler = handler
      return () => {}
    })
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.6-terra',
      modelProvider: 'custom',
      messages: [],
      inProgress: true,
      activeTurnId: 'turn-interrupted',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-interrupted')
    await state.loadMessages('thread-interrupted')
    state.startPolling()

    notificationHandler?.({
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-interrupted', turnId: 'turn-interrupted', itemId: 'live-output', delta: 'Partial output' },
    })
    expect(state.messages.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'live-output', text: 'Partial output', messageType: 'agentMessage.live' }),
    ]))

    notificationHandler?.({
      method: 'turn/completed',
      params: {
        threadId: 'thread-interrupted',
        turn: { id: 'turn-interrupted', status: 'interrupted' },
      },
    })
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.6-terra',
      modelProvider: 'custom',
      messages: [],
      inProgress: false,
      activeTurnId: '',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })
    await state.loadMessages('thread-interrupted', { force: true })

    expect(state.messages.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'live-output', text: 'Partial output', messageType: 'agentMessage.live' }),
    ]))
    expect(state.selectedInterruptedTurnId.value).toBe('turn-interrupted')
  })

  it('keeps a new live error visible when an older persisted turn error exists', async () => {
    installTestWindow()
    let notificationHandler: (notification: { method: string; params?: unknown }) => void = () => {}
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notificationHandler = handler
      return vi.fn()
    })
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      messages: [
        {
          id: 'old-error',
          role: 'system',
          text: 'old persisted failure',
          messageType: 'turnError',
        },
      ],
      inProgress: false,
      activeTurnId: '',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-with-errors')
    await state.loadMessages('thread-with-errors')
    state.startPolling()

    notificationHandler?.({
      method: 'turn/completed',
      params: {
        threadId: 'thread-with-errors',
        turnId: 'new-turn',
        turn: {
          id: 'new-turn',
          status: 'failed',
          error: { message: 'new live failure' },
        },
      },
    })

    expect(state.selectedLiveOverlay.value?.errorText).toBe('new live failure')
  })

  it('suppresses a live error only after that same error has persisted', async () => {
    installTestWindow()
    let notificationHandler: (notification: { method: string; params?: unknown }) => void = () => {}
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notificationHandler = handler
      return vi.fn()
    })
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      messages: [
        {
          id: 'persisted-error',
          role: 'system',
          text: 'same failure',
          messageType: 'turnError',
        },
      ],
      inProgress: false,
      activeTurnId: '',
      turnIndexByTurnId: {},
      hasMoreOlder: false,
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-with-persisted-error')
    await state.loadMessages('thread-with-persisted-error')
    state.startPolling()

    notificationHandler?.({
      method: 'turn/completed',
      params: {
        threadId: 'thread-with-persisted-error',
        turnId: 'same-turn',
        turn: {
          id: 'same-turn',
          status: 'failed',
          error: { message: 'same failure' },
        },
      },
    })

    expect(state.selectedLiveOverlay.value).toBe(null)
  })
})

describe('provider model selection', () => {
  it('uses the most recently selected thread model as the default for the next Codex chat', () => {
    installTestWindow()

    const state = useDesktopState()
    state.setSelectedModelIdForThread('thread-a', 'gpt-5.4-mini')

    expect(state.readModelIdForThread('thread-a')).toBe('gpt-5.4-mini')
    expect(state.readModelIdForThread('')).toBe('gpt-5.4-mini')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-model-by-context.v1') ?? '{}')).toEqual({
      'thread-a': 'gpt-5.4-mini',
      '__new-thread-provider__::codex': 'gpt-5.4-mini',
    })
  })

  it('does not replace the new-chat default while restoring an existing thread model', () => {
    installTestWindow({
      'codex-web-local.selected-model-by-context.v1': JSON.stringify({
        '__new-thread-provider__::codex': 'gpt-5.5',
      }),
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-a')
    state.setSelectedModelId('gpt-5.4-mini')

    expect(state.readModelIdForThread('thread-a')).toBe('gpt-5.4-mini')
    expect(state.readModelIdForThread('')).toBe('gpt-5.5')
  })

  it('keeps the official model list when the OpenAI provider uses the custom id', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.6-terra',
      providerId: 'custom',
      reasoningEffort: 'high',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning(
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
    ))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(gatewayMocks.getAvailableModels).toHaveBeenCalledWith({
      includeProviderModels: true,
      requireProviderModels: false,
      providerId: undefined,
    })
    expect(state.availableModelIds.value).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
    ])
    expect(state.selectedModelId.value).toBe('gpt-5.6-terra')
  })

  it('hides superseded official models from the picker when they are not in use', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-6-luna',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue([
      { ...modelsWithoutReasoning('gpt-6-astra')[0], displayName: 'GPT-6-Astra', isDefault: true },
      { ...modelsWithoutReasoning('gpt-6-luna')[0], displayName: 'GPT-6-Luna' },
      { ...modelsWithoutReasoning('gpt-5.5')[0], displayName: 'GPT-5.5', upgrade: 'gpt-5.6-sol' },
    ])

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.availableModelIds.value).toEqual(['gpt-6-astra', 'gpt-6-luna'])
    expect(state.availableModelLabels.value).toEqual({
      'gpt-6-astra': 'GPT-6-Astra',
      'gpt-6-luna': 'GPT-6-Luna',
      'gpt-5.5': 'GPT-5.5',
    })
  })

  it('retains a superseded official model while it is the configured selection', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue([
      { ...modelsWithoutReasoning('gpt-6-astra')[0], displayName: 'GPT-6-Astra', isDefault: true },
      { ...modelsWithoutReasoning('gpt-5.5')[0], displayName: 'GPT-5.5', upgrade: 'gpt-5.6-sol' },
    ])

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.availableModelIds.value).toEqual(['gpt-6-astra', 'gpt-5.5'])
    expect(state.selectedModelId.value).toBe('gpt-5.5')
  })

  it('ignores global selected-model localStorage when OpenCode Zen is the active provider', async () => {
    installTestWindow({
      'codex-web-local.selected-model-by-context.v1': JSON.stringify({
        '__new-thread__': 'gpt-5.5',
      }),
      'codex-web-local.selected-model-id.v1': 'gpt-5.5',
    })
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'big-pickle',
      providerId: 'opencode-zen',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning(
      'big-pickle',
      'deepseek-v4-flash-free',
      'ring-2.6-1t-free',
    ))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(gatewayMocks.getAvailableModels).toHaveBeenCalledWith({
      includeProviderModels: true,
      requireProviderModels: true,
      providerId: 'opencode-zen',
    })
    expect(state.availableModelIds.value).toEqual([
      'big-pickle',
      'deepseek-v4-flash-free',
      'ring-2.6-1t-free',
    ])
    expect(state.selectedModelId.value).toBe('big-pickle')
    expect(state.readModelIdForThread('').trim()).toBe('big-pickle')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-model-by-context.v1') ?? '{}')).toEqual({
      '__new-thread-provider__::opencode-zen': 'big-pickle',
    })
    expect(window.localStorage.getItem('codex-web-local.selected-model-id.v1')).toBe(null)
  })

  it('restores a valid provider-scoped OpenCode Zen selected model from localStorage', async () => {
    installTestWindow({
      'codex-web-local.selected-model-by-context.v1': JSON.stringify({
        '__new-thread-provider__::opencode-zen': 'ring-2.6-1t-free',
      }),
    })
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'big-pickle',
      providerId: 'opencode-zen',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning(
      'big-pickle',
      'deepseek-v4-flash-free',
      'ring-2.6-1t-free',
    ))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.availableModelIds.value).toEqual([
      'big-pickle',
      'deepseek-v4-flash-free',
      'ring-2.6-1t-free',
    ])
    expect(state.selectedModelId.value).toBe('ring-2.6-1t-free')
    expect(state.readModelIdForThread('').trim()).toBe('ring-2.6-1t-free')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-model-by-context.v1') ?? '{}')).toEqual({
      '__new-thread-provider__::opencode-zen': 'ring-2.6-1t-free',
    })
  })

  it('stores the new-thread Codex model in a provider-scoped slot', async () => {
    installTestWindow({
      'codex-web-local.selected-model-by-context.v1': JSON.stringify({
        '__new-thread-provider__::openrouter-free': 'openrouter/free',
      }),
    })
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning(
      'gpt-5.5',
      'gpt-5.4-mini',
    ))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.selectedModelId.value).toBe('gpt-5.5')
    expect(state.readModelIdForThread('').trim()).toBe('gpt-5.5')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-model-by-context.v1') ?? '{}')).toEqual({
      '__new-thread-provider__::openrouter-free': 'openrouter/free',
      '__new-thread-provider__::codex': 'gpt-5.5',
    })
  })

  it('drops stale non-Codex selected models from the Codex model list', async () => {
    installTestWindow({
      'codex-web-local.selected-model-by-context.v1': JSON.stringify({
        '__new-thread-provider__::codex': 'big-pickle',
      }),
    })
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning(
      'gpt-5.5',
      'gpt-5.4-mini',
    ))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.availableModelIds.value).toEqual([
      'gpt-5.5',
      'gpt-5.4-mini',
    ])
    expect(state.availableModelIds.value).not.toContain('big-pickle')
    expect(state.selectedModelId.value).toBe('gpt-5.5')
    expect(state.readModelIdForThread('').trim()).toBe('gpt-5.5')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-model-by-context.v1') ?? '{}')).toEqual({
      '__new-thread-provider__::codex': 'gpt-5.5',
    })
  })

  it('uses model-specific reasoning levels and clamps incompatible selections to the model default', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.6-sol',
      providerId: '',
      reasoningEffort: 'ultra',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue([
      {
        id: 'gpt-5.6-sol',
        displayName: 'GPT-5.6 Sol',
        hidden: false,
        isDefault: true,
        upgrade: null,
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
        defaultReasoningEffort: 'low',
      },
      {
        id: 'gpt-5.5',
        displayName: 'GPT-5.5',
        hidden: false,
        isDefault: false,
        upgrade: 'gpt-5.6-sol',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
        defaultReasoningEffort: 'medium',
      },
      {
        id: 'provider-model-without-metadata',
        displayName: 'provider-model-without-metadata',
        hidden: false,
        isDefault: false,
        upgrade: null,
        supportedReasoningEfforts: null,
        defaultReasoningEffort: null,
      },
    ])

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.selectedModelId.value).toBe('gpt-5.6-sol')
    expect(state.selectedReasoningEffort.value).toBe('ultra')
    expect(state.availableModelReasoningEfforts.value['gpt-5.5']).toEqual(['low', 'medium', 'high', 'xhigh'])

    state.setSelectedModelIdForThread('__new-thread__', 'gpt-5.5')
    expect(state.selectedReasoningEffort.value).toBe('medium')

    state.setSelectedReasoningEffort('ultra')
    expect(state.selectedReasoningEffort.value).toBe('medium')

    state.setSelectedModelIdForThread('__new-thread__', 'provider-model-without-metadata')
    state.setSelectedReasoningEffort('max')
    expect(state.selectedReasoningEffort.value).toBe('medium')
    state.setSelectedReasoningEffort('ultra')
    expect(state.selectedReasoningEffort.value).toBe('medium')
  })

  it('preserves a selected reasoning effort across model preference refreshes', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.6-sol',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue([{
      id: 'gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      hidden: false,
      isDefault: true,
      upgrade: null,
      supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
      defaultReasoningEffort: 'low',
    }])

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    state.setSelectedReasoningEffort('max')
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(state.selectedReasoningEffort.value).toBe('max')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-reasoning-effort-by-context.v1') ?? '{}')).toEqual({
      '__new-thread__': 'max',
    })
  })

  it('restores the reasoning effort reported by a resumed thread', async () => {
    installTestWindow()
    gatewayMocks.getAvailableModels.mockResolvedValue([{
      id: 'gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      hidden: false,
      isDefault: true,
      upgrade: null,
      supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
      defaultReasoningEffort: 'low',
    }])
    gatewayMocks.resumeThread.mockResolvedValue({
      model: 'gpt-5.6-sol',
      modelProvider: 'openai',
      reasoningEffort: 'max',
      permissionPreset: null,
      messages: [],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    const state = useDesktopState()
    state.primeSelectedThread('thread-with-max-effort')
    await state.loadMessages('thread-with-max-effort')

    expect(state.selectedReasoningEffort.value).toBe('max')
    expect(JSON.parse(window.localStorage.getItem('codex-web-local.selected-reasoning-effort-by-context.v1') ?? '{}')).toEqual({
      'thread-with-max-effort': 'max',
    })
  })

  it('keeps an existing OpenCode Zen thread locked to Zen models after Codex auth becomes active', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('legacy-zen-thread', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.4-mini',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockImplementation(async (options?: { providerId?: string }) => {
      if (options?.providerId === 'opencode-zen') {
        return modelsWithoutReasoning('big-pickle', 'ring-2.6-1t-free')
      }
      return modelsWithoutReasoning('gpt-5.5', 'gpt-5.4-mini')
    })
    gatewayMocks.resumeThread.mockResolvedValue({
      model: 'gpt-5.4-mini',
      modelProvider: 'opencode_zen',
      messages: [],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    const state = useDesktopState()
    state.primeSelectedThread('legacy-zen-thread')
    await state.loadMessages('legacy-zen-thread')
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })

    expect(gatewayMocks.getAvailableModels).toHaveBeenLastCalledWith({
      includeProviderModels: true,
      requireProviderModels: true,
      providerId: 'opencode-zen',
    })
    expect(state.availableModelIds.value).toEqual([
      'big-pickle',
      'ring-2.6-1t-free',
    ])
    expect(state.selectedModelId.value).toBe('big-pickle')
    expect(state.readModelIdForThread('legacy-zen-thread')).toBe('big-pickle')
    expect(state.readModelIdForThread('')).toBe('gpt-5.4-mini')
  })

  it('loads provider models for a selected provider-backed thread during scheduled refreshes', async () => {
    installTestWindow()
    vi.mocked(window.setTimeout).mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        void Promise.resolve().then(() => callback())
      }
      return 1
    }) as typeof window.setTimeout)
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('legacy-zen-thread', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.4-mini',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockImplementation(async (options?: { providerId?: string }) => {
      if (options?.providerId === 'opencode-zen') {
        return modelsWithoutReasoning('big-pickle', 'ring-2.6-1t-free')
      }
      return modelsWithoutReasoning('gpt-5.5', 'gpt-5.4-mini')
    })
    gatewayMocks.resumeThread.mockResolvedValue({
      model: 'gpt-5.4-mini',
      modelProvider: 'opencode_zen',
      messages: [],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    const state = useDesktopState()
    state.primeSelectedThread('legacy-zen-thread')
    await state.loadMessages('legacy-zen-thread')
    await state.refreshAll({ includeSelectedThreadMessages: false })
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

    expect(gatewayMocks.getAvailableModels).toHaveBeenLastCalledWith({
      includeProviderModels: true,
      requireProviderModels: true,
      providerId: 'opencode-zen',
    })
    expect(state.availableModelIds.value).toEqual(['big-pickle', 'ring-2.6-1t-free'])
    expect(state.selectedModelId.value).toBe('big-pickle')
  })

  it('captures the active provider when creating a new thread', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5', 'gpt-5.4-mini'))
    gatewayMocks.startThread.mockResolvedValue({
      threadId: 'codex-thread',
      cwd: '/tmp/project',
      model: 'gpt-5.5',
      modelProvider: 'openai',
    })
    gatewayMocks.startThreadTurn.mockResolvedValue('turn-1')
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.5',
      modelProvider: 'openai',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Hi.',
          messageType: 'agentMessage',
        },
      ],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    await state.sendMessageToNewThread('hi', '/tmp/project')

    expect(gatewayMocks.startThread).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      outputDirectory: undefined,
      workspaceRoot: undefined,
      model: 'gpt-5.5',
    })
    expect(gatewayMocks.startThreadTurn).toHaveBeenCalledWith(
      'codex-thread',
      'hi',
      [],
      'gpt-5.5',
      'medium',
      undefined,
      [],
      'default',
      {
        approvalPolicy: 'on-request',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: ['/tmp/project'],
          networkAccess: true,
          excludeTmpdirEnvVar: false,
          excludeSlashTmp: false,
        },
      },
    )
    expect(state.readModelIdForThread('codex-thread')).toBe('gpt-5.5')
    expect(state.messages.value.some((message) => (
      message.role === 'user' &&
      message.text === 'hi' &&
      message.messageType === 'userMessage.optimistic'
    ))).toBe(true)

    const modelConfigCallsBeforeLoad = gatewayMocks.getCurrentModelConfig.mock.calls.length
    const availableModelCallsBeforeLoad = gatewayMocks.getAvailableModels.mock.calls.length
    await state.loadMessages('codex-thread')
    expect(gatewayMocks.getCurrentModelConfig).toHaveBeenCalledTimes(modelConfigCallsBeforeLoad)
    expect(gatewayMocks.getAvailableModels).toHaveBeenCalledTimes(availableModelCallsBeforeLoad)
    expect(state.messages.value.map((message) => `${message.role}:${message.text}`)).toEqual([
      'user:hi',
      'assistant:Hi.',
    ])
  })

  it('shows an optimistic user message before Thinking in an existing thread', async () => {
    installTestWindow()
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('existing-thread', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5'))
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.5',
      modelProvider: 'openai',
      messages: [
        {
          id: 'assistant-existing',
          role: 'assistant',
          text: 'Ready.',
          messageType: 'agentMessage',
        },
      ],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    let resolveTurnStart: ((turnId: string) => void) | undefined
    gatewayMocks.startThreadTurn.mockImplementation(() => new Promise<string>((resolve) => {
      resolveTurnStart = resolve
    }))

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    state.primeSelectedThread('existing-thread')
    await state.loadMessages('existing-thread')

    const imageUrl = '/codex-local-image?path=C%3A%5Cuploads%5Cscreen.png'
    const sendPromise = state.sendMessageToSelectedThread('Run the checks', [imageUrl])
    await Promise.resolve()
    await Promise.resolve()

    expect(state.messages.value.filter((message) => (
      message.role === 'user' && message.text === 'Run the checks'
    ))).toEqual([
      expect.objectContaining({
        role: 'user',
        text: 'Run the checks',
        images: [imageUrl],
        fileAttachments: [
          expect.objectContaining({
            label: 'screen.png',
            path: 'C:\\uploads\\screen.png',
          }),
        ],
        messageType: 'userMessage.optimistic',
      }),
    ])
    expect(state.selectedLiveOverlay.value).toMatchObject({
      activityLabel: 'Sending message',
      reasoningText: '',
      errorText: '',
    })

    resolveTurnStart?.('turn-existing')
    await sendPromise
  })

  it('keeps internal ChatGPT reference context out of optimistic message text', async () => {
    installTestWindow()
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'Project', threads: [thread('reference-thread', '/tmp/project')] }],
      nextCursor: null,
    })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5'))
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.5',
      modelProvider: 'openai',
      messages: [],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })
    gatewayMocks.startThreadTurn.mockResolvedValue('turn-reference')

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    state.primeSelectedThread('reference-thread')
    await state.loadMessages('reference-thread')

    const visibleText = '[Recommended plugin](chatgpt-conversation://conversation-id)'
    const submittedText = `${visibleText}\n\n${buildChatGptConversationReferenceBlock({
      conversationId: 'conversation-id',
      title: 'Recommended plugin',
      preview: null,
    })}`
    await state.sendMessageToSelectedThread(submittedText)

    expect(state.messages.value.at(-1)?.text).toBe(visibleText)
    expect(gatewayMocks.startThreadTurn.mock.calls.at(-1)?.[0]).toBe('reference-thread')
    expect(gatewayMocks.startThreadTurn.mock.calls.at(-1)?.[1]).toBe(submittedText)
  })

  it('steers an active turn without starting another turn', async () => {
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.5',
      modelProvider: 'openai',
      messages: [{ id: 'assistant-active', role: 'assistant', text: 'Working.', messageType: 'agentMessage' }],
      inProgress: true,
      activeTurnId: 'turn-active',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })
    gatewayMocks.steerThreadTurn.mockResolvedValue('turn-active')

    const state = useDesktopState()
    state.primeSelectedThread('active-thread')
    await state.loadMessages('active-thread')

    const imageUrl = '/codex-local-image?path=C%3A%5Cuploads%5Cscreen.png'
    await state.sendMessageToSelectedThread('Focus on tests first.', [imageUrl], [], 'steer')

    expect(gatewayMocks.steerThreadTurn).toHaveBeenCalledWith(
      'active-thread',
      'turn-active',
      'Focus on tests first.',
      [imageUrl],
      [],
      [],
    )
    expect(gatewayMocks.startThreadTurn).not.toHaveBeenCalled()
    expect(state.messages.value.at(-1)).toMatchObject({
      role: 'user',
      text: 'Focus on tests first.',
      images: [imageUrl],
      fileAttachments: [
        expect.objectContaining({
          label: 'screen.png',
          path: 'C:\\uploads\\screen.png',
        }),
      ],
      messageType: 'userMessage.optimistic',
    })
  })

  it('starts a normal turn when an active steer no longer has a turn id', async () => {
    gatewayMocks.getPendingServerRequests.mockResolvedValue([])
    gatewayMocks.resumeThread
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        model: 'gpt-5.5',
        modelProvider: 'openai',
        permissionPreset: null,
        messages: [],
        inProgress: false,
        activeTurnId: '',
        hasMoreOlder: false,
        turnIndexByTurnId: {},
      })
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.5',
      modelProvider: 'openai',
      messages: [{ id: 'assistant-finished', role: 'assistant', text: 'Finished.', messageType: 'agentMessage' }],
      inProgress: true,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })
    gatewayMocks.startThreadTurn.mockResolvedValue('turn-next')

    const state = useDesktopState()
    state.primeSelectedThread('racing-thread')
    await state.loadMessages('racing-thread')

    await state.sendMessageToSelectedThread('Continue with the next task.', [], [], 'steer')

    expect(gatewayMocks.steerThreadTurn).not.toHaveBeenCalled()
    expect(gatewayMocks.startThreadTurn).toHaveBeenCalled()
    expect(state.messages.value.at(-1)).toMatchObject({
      role: 'user',
      text: 'Continue with the next task.',
      messageType: 'userMessage.optimistic',
    })
  })

  it('refreshes a loaded optimistic thread when completion events arrive', async () => {
    installTestWindow()
    vi.mocked(window.setTimeout).mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        void Promise.resolve().then(() => callback())
      }
      return 1
    }) as typeof window.setTimeout)
    let notificationHandler: ((notification: { method: string; params?: unknown }) => void) | undefined
    gatewayMocks.subscribeCodexNotifications.mockImplementation((handler) => {
      notificationHandler = handler as typeof notificationHandler
      return vi.fn()
    })
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.4-mini',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5', 'gpt-5.4-mini'))
    gatewayMocks.startThread.mockResolvedValue({
      threadId: 'mini-thread',
      cwd: '/tmp/project',
      model: 'gpt-5.4-mini',
      modelProvider: 'openai',
    })
    gatewayMocks.startThreadTurn.mockResolvedValue('turn-1')
    gatewayMocks.getThreadDetail.mockResolvedValue({
      model: 'gpt-5.4-mini',
      modelProvider: 'openai',
      messages: [
        {
          id: 'user-1',
          role: 'user',
          text: 'hi',
          messageType: 'userMessage',
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Hi.',
          messageType: 'agentMessage',
        },
      ],
      inProgress: false,
      activeTurnId: '',
      hasMoreOlder: false,
      turnIndexByTurnId: {},
    })

    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    await state.sendMessageToNewThread('hi', '/tmp/project')
    state.startPolling()
    expect(notificationHandler).toBeDefined()
    notificationHandler!({
      method: 'turn/completed',
      params: {
        threadId: 'mini-thread',
        turn: { id: 'turn-1', status: 'completed' },
      },
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(gatewayMocks.getThreadDetail).toHaveBeenCalledWith('mini-thread')
    expect(state.messages.value.map((message) => `${message.role}:${message.text}`)).toEqual([
      'user:hi',
      'system:Worked for <1s',
      'assistant:Hi.',
    ])
  })

  it('surfaces selected thread load failures and still refreshes models', async () => {
    installTestWindow()
    gatewayMocks.getThreadGroupsPage.mockResolvedValue({ groups: [], nextCursor: null })
    gatewayMocks.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
    gatewayMocks.getSkillsList.mockResolvedValue([])
    gatewayMocks.getAccountRateLimits.mockResolvedValue(null)
    gatewayMocks.getCurrentModelConfig.mockResolvedValue({
      model: 'gpt-5.5',
      providerId: '',
      reasoningEffort: 'medium',
      speedMode: 'standard',
    })
    gatewayMocks.getAvailableModels.mockResolvedValue(modelsWithoutReasoning('gpt-5.5', 'gpt-5.4-mini'))
    gatewayMocks.resumeThread.mockRejectedValue(new Error('thread not found'))

    const state = useDesktopState()
    state.primeSelectedThread('missing-thread')
    await state.refreshAll({
      includeSelectedThreadMessages: true,
      awaitAncillaryRefreshes: true,
    })

    expect(state.selectedLiveOverlay.value?.errorText).toContain('thread not found')
    expect(state.availableModelIds.value).toEqual(['gpt-5.5', 'gpt-5.4-mini'])
    expect(state.selectedModelId.value).toBe('gpt-5.5')

    await state.ensureThreadMessagesLoaded('missing-thread', { silent: true })
    await state.loadMessages('missing-thread')
    expect(gatewayMocks.resumeThread).toHaveBeenCalledTimes(1)
  })
})

describe('thread message refresh', () => {
  it('bypasses the recent-message cache and reconciles a completed server snapshot', async () => {
    gatewayMocks.resumeThread.mockResolvedValue(null)
    gatewayMocks.getThreadDetail
      .mockResolvedValueOnce({
        messages: [
          { id: 'assistant-live', role: 'assistant', text: 'Almost done', messageType: 'agentMessage' },
        ],
        inProgress: true,
        activeTurnId: 'turn-1',
        turnIndexByTurnId: {},
        hasMoreOlder: false,
      })
      .mockResolvedValueOnce({
        messages: [
          { id: 'assistant-final', role: 'assistant', text: 'Finished', messageType: 'agentMessage' },
        ],
        inProgress: false,
        activeTurnId: '',
        turnIndexByTurnId: {},
        hasMoreOlder: false,
      })

    const state = useDesktopState()
    state.primeSelectedThread('stale-thread')
    await state.loadMessages('stale-thread')

    const result = await state.refreshSelectedThreadMessages()

    expect(gatewayMocks.getThreadDetail).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ updated: true, inProgress: false })
    expect(state.messages.value).toEqual([
      expect.objectContaining({ id: 'assistant-final', text: 'Finished' }),
    ])
  })
})

describe('findAdjacentThreadId', () => {
  it('selects the next thread after the archived thread', () => {
    const threads = [
      thread('first-thread', '/tmp/project'),
      thread('selected-thread', '/tmp/project'),
      thread('next-thread', '/tmp/project'),
    ]

    expect(findAdjacentThreadId(threads, 'selected-thread')).toBe('next-thread')
  })

  it('falls back to the previous thread when the last thread is archived', () => {
    const threads = [
      thread('previous-thread', '/tmp/project'),
      thread('selected-thread', '/tmp/project'),
    ]

    expect(findAdjacentThreadId(threads, 'selected-thread')).toBe('previous-thread')
  })

  it('returns no fallback when there is no adjacent thread', () => {
    expect(findAdjacentThreadId([thread('selected-thread', '/tmp/project')], 'selected-thread')).toBe('')
  })
})
