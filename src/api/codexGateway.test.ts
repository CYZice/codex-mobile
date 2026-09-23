import { afterEach, describe, expect, it, vi } from 'vitest'
import { compactThread, getAvailableModelIds, getAvailableModels, getCodexActivitySummary, getCodexNativeSettings, getCurrentModelConfig, getThreadDetail, listChatGptConversations, reloadCodexAppServer, resumeThread, saveCodexNativeSettings, startThreadReview, startThreadTurn, steerThreadTurn } from './codexGateway'

function mockRpcFetch(): { requests: Array<{ method: string, params: Record<string, unknown> }> } {
  const requests: Array<{ method: string, params: Record<string, unknown> }> = []

  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { method: string, params: Record<string, unknown> }
      : { method: '', params: {} }

    requests.push(body)

    return new Response(JSON.stringify({
      result: {
        turn: {
          id: `turn-${requests.length}`,
        },
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }))

  return { requests }
}

describe('native review and context commands', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the selected semantic review target without silently falling back to uncommitted', async () => {
    const { requests } = mockRpcFetch()
    await startThreadReview('thread-a', { type: 'uncommittedChanges' })
    await startThreadReview('thread-a', { type: 'baseBranch', branch: ' origin/main ' })
    await startThreadReview('thread-a', { type: 'commit', sha: '123abc45' })
    expect(requests.map((request) => request.params.target)).toEqual([
      { type: 'uncommittedChanges' },
      { type: 'baseBranch', branch: 'origin/main' },
      { type: 'commit', sha: '123abc45' },
    ])
    expect(requests.every((request) => request.method === 'review/start' && request.params.delivery === 'inline')).toBe(true)
    await expect(startThreadReview('thread-a', { type: 'baseBranch', branch: '' })).rejects.toThrow('Base branch')
    await expect(startThreadReview('thread-a', { type: 'commit', sha: 'not a sha' })).rejects.toThrow('commit SHA')
    expect(requests).toHaveLength(3)
  })

  it('starts native compaction without pretending to clear the entire conversation', async () => {
    const { requests } = mockRpcFetch()
    await compactThread('thread-a')
    expect(requests).toEqual([{ method: 'thread/compact/start', params: { threadId: 'thread-a' } }])
  })
})

describe('Codex app-server runtime reload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests the dedicated runtime reload endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await reloadCodexAppServer()

    expect(fetchMock).toHaveBeenCalledWith('/codex-api/runtime/reload', { method: 'POST' })
  })
})

describe('Codex activity summary', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the current JSON summary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        totalChats: 12,
        archivedChats: 2,
        activeDays: 4,
        totalTokens: 3200,
        topModel: 'gpt-5.6-terra',
        topReasoningEffort: 'medium',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } })))

    await expect(getCodexActivitySummary()).resolves.toMatchObject({ totalChats: 12, topModel: 'gpt-5.6-terra' })
  })

  it('explains when an old web host serves the app shell instead of JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))

    await expect(getCodexActivitySummary()).rejects.toThrow('Restart Codex Mobile to load Activity data')
  })
})

describe('native Codex settings', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the project layer and writes back to its config.toml', async () => {
    const requests: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>
      requests.push(request)
      return new Response(JSON.stringify({ result: request.method === 'config/read' ? {
        config: {}, origins: {}, layers: [{ name: { type: 'project', dotCodexFolder: 'D:\\repo\\.codex' }, version: 'v1', config: { model: 'gpt-5.6-sol', sandbox_mode: 'workspace-write' }, disabledReason: null }],
      } : {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const settings = await getCodexNativeSettings('project', 'D:\\repo')
    expect(settings.filePath).toBe('D:\\repo\\.codex/config.toml')
    expect(settings.model).toBe('gpt-5.6-sol')
    await saveCodexNativeSettings(settings)
    expect(requests[1]).toMatchObject({ method: 'config/batchWrite', params: { filePath: 'D:\\repo\\.codex/config.toml', expectedVersion: 'v1' } })
  })

  it('never falls back from a missing project path to the user config', async () => {
    await expect(saveCodexNativeSettings({
      scope: 'project', filePath: null, version: null, model: '', reasoningEffort: '', approvalPolicy: '', sandboxMode: '', networkAccess: false, webSearch: '', verbosity: '', reasoningSummary: '',
    })).rejects.toThrow('did not expose a Project config path')
  })
})

describe('ChatGPT conversation loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('surfaces the server connection detail when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'Unable to connect to ChatGPT via http://127.0.0.1:7897 proxy',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(listChatGptConversations()).rejects.toThrow('Unable to connect to ChatGPT via http://127.0.0.1:7897 proxy')
  })

  it('requests a bounded page and returns its next offset', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ conversationId: 'conversation-1', title: 'First chat' }],
      nextOffset: 50,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listChatGptConversations(0, 100)).resolves.toEqual({
      conversations: [{ conversationId: 'conversation-1', title: 'First chat', updatedAt: null }],
      nextOffset: 50,
    })
    expect(fetchMock).toHaveBeenCalledWith('/codex-api/chatgpt-conversations?offset=0&limit=50')
  })
})

describe('startThreadTurn collaboration mode payloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends default collaboration mode explicitly after a plan turn', async () => {
    const { requests } = mockRpcFetch()

    await startThreadTurn('thread-1', 'make a plan', [], 'gpt-5.4', 'medium', undefined, [], 'plan')
    await startThreadTurn('thread-1', 'implement it', [], 'gpt-5.4', 'medium', undefined, [], 'default')

    expect(requests).toHaveLength(2)
    expect(requests[0].method).toBe('turn/start')
    expect(requests[0].params.collaborationMode).toEqual({
      mode: 'plan',
      settings: {
        model: 'gpt-5.4',
        reasoning_effort: 'medium',
        developer_instructions: null,
      },
    })
    expect(requests[1].method).toBe('turn/start')
    expect(requests[1].params.collaborationMode).toEqual({
      mode: 'default',
      settings: {
        model: 'gpt-5.4',
        reasoning_effort: 'medium',
        developer_instructions: null,
      },
    })
  })

  it.each(['max', 'ultra'] as const)('passes GPT-5.6 %s reasoning through to Codex', async (reasoningEffort) => {
    const { requests } = mockRpcFetch()

    await startThreadTurn('thread-1', 'solve it', [], 'gpt-5.6-sol', reasoningEffort, undefined, [], 'default')

    expect(requests[0].params.effort).toBe(reasoningEffort)
    expect(requests[0].params.collaborationMode).toEqual({
      mode: 'default',
      settings: {
        model: 'gpt-5.6-sol',
        reasoning_effort: reasoningEffort,
        developer_instructions: null,
      },
    })
  })

  it('sends the thread permission configuration with each turn', async () => {
    const { requests } = mockRpcFetch()

    await startThreadTurn(
      'thread-1',
      'update the project',
      [],
      'gpt-5.4',
      'medium',
      undefined,
      [],
      'default',
      {
        approvalPolicy: 'on-request',
        approvalsReviewer: 'auto_review',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: ['D:\\Projects\\LiDAR FPGA'],
          networkAccess: true,
          excludeTmpdirEnvVar: false,
          excludeSlashTmp: false,
        },
      },
    )

    expect(requests[0].params).toMatchObject({
      approvalPolicy: 'on-request',
      approvalsReviewer: 'auto_review',
      sandboxPolicy: {
        type: 'workspaceWrite',
        writableRoots: ['D:\\Projects\\LiDAR FPGA'],
        networkAccess: true,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
      },
    })
  })
})

describe('steerThreadTurn', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('appends input to the active turn without turn-level overrides', async () => {
    const requests: Array<{ method: string, params: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as { method: string, params: Record<string, unknown> })
      return new Response(JSON.stringify({ result: { turnId: 'turn-active' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(steerThreadTurn('thread-1', 'turn-active', 'Focus on tests first.')).resolves.toBe('turn-active')
    expect(requests).toEqual([{
      method: 'turn/steer',
      params: {
        threadId: 'thread-1',
        expectedTurnId: 'turn-active',
        input: [{ type: 'text', text: 'Focus on tests first.' }],
      },
    }])
  })
})

describe('getCurrentModelConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['max', 'ultra'] as const)('keeps the GPT-5.6 %s reasoning level', async (reasoningEffort) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        config: {
          model: 'gpt-5.6-sol',
          model_provider: 'openai',
          model_reasoning_effort: reasoningEffort,
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(getCurrentModelConfig()).resolves.toMatchObject({
      model: 'gpt-5.6-sol',
      reasoningEffort,
    })
  })
})

describe('getAvailableModelIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses provider models without waiting for model/list when provider models are required', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input))
      if (String(input) === '/codex-api/provider-models') {
        return new Response(JSON.stringify({
          data: ['big-pickle', 'deepseek-v4-flash-free'],
          exclusive: true,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${String(input)}`)
    }))

    await expect(getAvailableModelIds({
      includeProviderModels: true,
      requireProviderModels: true,
    })).resolves.toEqual(['big-pickle', 'deepseek-v4-flash-free'])
    expect(requests).toEqual(['/codex-api/provider-models'])
  })

  it('requests models for an explicit thread provider', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input))
      if (String(input) === '/codex-api/provider-models?provider=opencode-zen') {
        return new Response(JSON.stringify({
          data: ['big-pickle', 'ring-2.6-1t-free'],
          exclusive: true,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${String(input)}`)
    }))

    await expect(getAvailableModelIds({
      includeProviderModels: true,
      requireProviderModels: true,
      providerId: 'opencode-zen',
    })).resolves.toEqual(['big-pickle', 'ring-2.6-1t-free'])
    expect(requests).toEqual(['/codex-api/provider-models?provider=opencode-zen'])
  })

  it('falls back to model/list when provider models are optional and unavailable', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(input))
      if (String(input) === '/codex-api/provider-models') {
        return new Response(JSON.stringify({ data: [] }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string }
        : { method: '' }
      expect(body.method).toBe('model/list')
      return new Response(JSON.stringify({
        result: {
          data: [
            { id: 'gpt-5.5' },
            { model: 'gpt-5.4-mini' },
          ],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(getAvailableModelIds({
      includeProviderModels: true,
    })).resolves.toEqual(['gpt-5.5', 'gpt-5.4-mini'])
    expect(requests).toEqual(['/codex-api/provider-models', '/codex-api/rpc'])
  })

  it('preserves model-specific reasoning metadata from model/list', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string }
        : { method: '' }
      expect(body.method).toBe('model/list')
      return new Response(JSON.stringify({
        result: {
          data: [
            {
              id: 'gpt-5.6-sol',
              displayName: 'GPT-5.6 Sol',
              hidden: false,
              isDefault: true,
              upgrade: null,
              supportedReasoningEfforts: [
                { reasoningEffort: 'low' },
                { reasoningEffort: 'max' },
                { reasoningEffort: 'ultra' },
              ],
              defaultReasoningEffort: 'low',
            },
            {
              id: 'gpt-5.5',
              displayName: 'GPT-5.5',
              hidden: false,
              isDefault: false,
              upgrade: 'gpt-5.6-sol',
              supportedReasoningEfforts: [
                { reasoningEffort: 'low' },
                { reasoningEffort: 'xhigh' },
              ],
              defaultReasoningEffort: 'low',
            },
          ],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(getAvailableModels({ includeProviderModels: false })).resolves.toEqual([
      {
        id: 'gpt-5.6-sol',
        displayName: 'GPT-5.6 Sol',
        hidden: false,
        isDefault: true,
        upgrade: null,
        supportedReasoningEfforts: ['low', 'max', 'ultra'],
        defaultReasoningEffort: 'low',
      },
      {
        id: 'gpt-5.5',
        displayName: 'GPT-5.5',
        hidden: false,
        isDefault: false,
        upgrade: 'gpt-5.6-sol',
        supportedReasoningEfforts: ['low', 'xhigh'],
        defaultReasoningEffort: 'low',
      },
    ])
  })

  it('follows model/list pagination and filters hidden catalog entries', async () => {
    const cursors: Array<string | null> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params?: { cursor?: string | null; includeHidden?: boolean; limit?: number } }
        : { method: '', params: {} }
      expect(body.method).toBe('model/list')
      expect(body.params?.includeHidden).toBe(false)
      expect(body.params?.limit).toBe(100)
      cursors.push(body.params?.cursor ?? null)
      const isSecondPage = body.params?.cursor === 'page-2'
      return new Response(JSON.stringify({
        result: isSecondPage
          ? {
              data: [
                { id: 'gpt-6-sol', displayName: 'GPT-6 Sol', hidden: false, isDefault: true },
                { id: 'gpt-5.4', displayName: 'GPT-5.4', hidden: true, isDefault: false },
              ],
              nextCursor: null,
            }
          : {
              data: [
                { id: 'gpt-6-luna', displayName: 'GPT-6 Luna', hidden: false, isDefault: false },
              ],
              nextCursor: 'page-2',
            },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(getAvailableModels({ includeProviderModels: false })).resolves.toEqual([
      expect.objectContaining({ id: 'gpt-6-luna', displayName: 'GPT-6 Luna', hidden: false }),
      expect.objectContaining({ id: 'gpt-6-sol', displayName: 'GPT-6 Sol', hidden: false, isDefault: true }),
    ])
    expect(cursors).toEqual([null, 'page-2'])
  })
})

describe('getThreadDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads modelProvider from nested thread payloads returned by thread/read', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      expect(body.method).toBe('thread/read')
      return new Response(JSON.stringify({
        result: {
          thread: {
            id: body.params.threadId,
            modelProvider: 'opencode_zen',
            turns: [],
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(getThreadDetail('legacy-thread')).resolves.toMatchObject({
      modelProvider: 'opencode_zen',
    })
  })
})

describe('resumeThread', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reads the reasoning effort reported by thread/resume', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      expect(body).toEqual({
        method: 'thread/resume',
        params: { threadId: 'thread-with-ultra-effort' },
      })
      return new Response(JSON.stringify({
        result: {
          approvalPolicy: 'on-request',
          cwd: '/workspace',
          model: 'gpt-5.6-sol',
          modelProvider: 'openai',
          reasoningEffort: 'ultra',
          sandbox: { type: 'workspace-write' },
          thread: {
            id: 'thread-with-ultra-effort',
            turns: [],
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(resumeThread('thread-with-ultra-effort')).resolves.toMatchObject({
      model: 'gpt-5.6-sol',
      modelProvider: 'openai',
      reasoningEffort: 'ultra',
    })
  })

  it('coalesces repeated resume failures for the same thread', async () => {
    const requests: Array<{ method: string; params: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      requests.push(body)
      return new Response(JSON.stringify({ error: 'no rollout found for thread id missing-thread' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const results = await Promise.allSettled([
      resumeThread('missing-thread'),
      resumeThread('missing-thread'),
    ])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(requests).toEqual([
      { method: 'thread/resume', params: { threadId: 'missing-thread' } },
    ])
  })

  it('evicts a stalled resume so later resume attempts are not pinned forever', async () => {
    vi.useFakeTimers()
    const requests: Array<{ method: string; params: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      requests.push(body)
      return new Promise<Response>(() => undefined)
    }))

    const first = resumeThread('stalled-thread')
    void resumeThread('stalled-thread')
    expect(requests).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(30_000)

    const retried = resumeThread('stalled-thread')
    expect(retried).not.toBe(first)
    expect(requests).toEqual([
      { method: 'thread/resume', params: { threadId: 'stalled-thread' } },
      { method: 'thread/resume', params: { threadId: 'stalled-thread' } },
    ])
  })
})
