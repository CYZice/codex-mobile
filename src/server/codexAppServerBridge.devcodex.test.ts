import { describe, expect, it } from 'vitest'
import {
  dispatchDevCodex,
  interruptDevCodexTurn,
  isDevCodexThreadBusy,
  readDevCodexTurnStatus,
  type DevCodexQueueProcessor,
  type RpcExecutor,
  type StoredQueuedMessage,
} from './codexAppServerBridge.js'

describe('DevCodex bridge v2', () => {
  it('detects active runtime, approval, and in-progress turn states', () => {
    expect(isDevCodexThreadBusy({ thread: { status: { type: 'active' }, turns: [] } })).toBe(true)
    expect(isDevCodexThreadBusy({ thread: { status: { type: 'waitingForApproval' }, turns: [] } })).toBe(true)
    expect(isDevCodexThreadBusy({ thread: { status: { type: 'idle' }, turns: [{ status: 'inProgress' }] } })).toBe(true)
    expect(isDevCodexThreadBusy({ thread: { status: { type: 'idle' }, turns: [{ status: 'completed' }] } })).toBe(false)
  })

  it('creates a native thread and starts its first real turn', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    const appServer: RpcExecutor = {
      rpc: async (method, params) => {
        calls.push({ method, params })
        if (method === 'thread/start') return { thread: { id: 'thread-new', cwd: 'C:/repo' } }
        throw new Error(`unexpected ${method}`)
      },
    }
    const processor = fakeProcessor({ startedTurnId: 'turn-first' })
    const result = await dispatchDevCodex(appServer, processor, {
      message: 'Inspect the project.',
      target: { type: 'new', cwd: 'C:/repo' },
      mode: 'start',
    }, dependencies())

    expect(result).toEqual({
      threadId: 'thread-new',
      turnId: 'turn-first',
      cwd: 'C:/repo',
      state: 'running',
    })
    expect(calls).toEqual([{ method: 'thread/start', params: { cwd: 'C:/repo' } }])
    expect(processor.started).toMatchObject({ threadId: 'thread-new', options: { cwd: 'C:/repo', resume: false } })
  })

  it('rejects start on a busy existing thread instead of queueing', async () => {
    const appServer = threadReader({
      thread: { id: 'thread-1', cwd: 'C:/repo', status: { type: 'active' }, turns: [{ id: 'turn-active', status: 'inProgress' }] },
    })
    const queued: StoredQueuedMessage[] = []
    await expect(dispatchDevCodex(appServer, fakeProcessor(), {
      message: 'Do this next.',
      target: { type: 'thread', threadId: 'thread-1' },
      mode: 'start',
    }, dependencies(queued))).rejects.toMatchObject({ code: 'THREAD_BUSY' })
    expect(queued).toHaveLength(0)
  })

  it('uses the existing queue only when mode=queue', async () => {
    const appServer = threadReader({
      thread: { id: 'thread-1', cwd: 'C:/repo', status: { type: 'active' }, turns: [{ id: 'turn-active', status: 'inProgress' }] },
    })
    const queued: StoredQueuedMessage[] = []
    const processor = fakeProcessor()
    const result = await dispatchDevCodex(appServer, processor, {
      message: 'Do this after the active turn.',
      target: { type: 'thread', threadId: 'thread-1' },
      mode: 'queue',
    }, dependencies(queued))

    expect(result).toMatchObject({ threadId: 'thread-1', cwd: 'C:/repo', state: 'queued' })
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ text: 'Do this after the active turn.', permissionPreset: 'fullAccess' })
  })

  it('steers the exact active turn and refuses an idle thread', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    const active = threadReader({
      thread: { id: 'thread-1', cwd: 'C:/repo', turns: [{ id: 'turn-active', status: 'inProgress' }] },
    }, calls)
    const result = await dispatchDevCodex(active, fakeProcessor(), {
      message: 'Keep the investigation; drop the refactor.',
      target: { type: 'thread', threadId: 'thread-1' },
      mode: 'steer',
    }, dependencies())
    expect(result).toMatchObject({ threadId: 'thread-1', turnId: 'turn-active', state: 'running' })
    expect(calls.at(-1)).toEqual({
      method: 'turn/steer',
      params: {
        threadId: 'thread-1',
        expectedTurnId: 'turn-active',
        input: [{ type: 'text', text: 'Keep the investigation; drop the refactor.' }],
      },
    })

    const idle = threadReader({ thread: { id: 'thread-idle', turns: [{ id: 'turn-done', status: 'completed' }] } })
    await expect(dispatchDevCodex(idle, fakeProcessor(), {
      message: 'This must not become start.',
      target: { type: 'thread', threadId: 'thread-idle' },
      mode: 'steer',
    }, dependencies())).rejects.toMatchObject({ code: 'NO_ACTIVE_TURN' })
  })

  it('returns factual active, queued, and exact completed turn status', async () => {
    const read = threadReader({
      thread: {
        id: 'thread-1',
        cwd: 'C:/repo',
        turns: [
          { id: 'turn-old', status: 'completed' },
          { id: 'turn-active', status: 'inProgress' },
        ],
      },
    })
    const queue = [message('queued-1'), message('queued-2')]
    await expect(readDevCodexTurnStatus(read, 'thread-1', undefined, queueDependencies(queue))).resolves.toEqual({
      threadId: 'thread-1',
      turnId: 'turn-active',
      cwd: 'C:/repo',
      state: 'running',
      queuedCount: 2,
    })
    await expect(readDevCodexTurnStatus(read, 'thread-1', 'turn-old', queueDependencies(queue))).resolves.toEqual({
      threadId: 'thread-1',
      turnId: 'turn-old',
      cwd: 'C:/repo',
      state: 'completed',
      queuedCount: 2,
    })
  })

  it('interrupts only an exact active turn belonging to the thread', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    const appServer = threadReader({
      thread: { id: 'thread-1', cwd: 'C:/repo', turns: [{ id: 'turn-active', status: 'inProgress' }, { id: 'turn-old', status: 'completed' }] },
    }, calls)
    await expect(interruptDevCodexTurn(appServer, 'thread-1', 'turn-active')).resolves.toEqual({
      threadId: 'thread-1',
      turnId: 'turn-active',
      cwd: 'C:/repo',
      state: 'interrupt_requested',
    })
    expect(calls.at(-1)).toEqual({ method: 'turn/interrupt', params: { threadId: 'thread-1', turnId: 'turn-active' } })
    await expect(interruptDevCodexTurn(appServer, 'thread-1', 'turn-old')).rejects.toMatchObject({ code: 'TURN_NOT_ACTIVE' })
    await expect(interruptDevCodexTurn(appServer, 'thread-1', 'turn-missing')).rejects.toMatchObject({ code: 'TURN_NOT_FOUND' })
  })
})

function threadReader(value: unknown, calls: Array<{ method: string; params: unknown }> = []): RpcExecutor {
  return {
    rpc: async (method, params) => {
      calls.push({ method, params })
      if (method === 'thread/read') return value
      if (method === 'turn/steer' || method === 'turn/interrupt') return {}
      throw new Error(`unexpected ${method}`)
    },
  }
}

function fakeProcessor(options: { startedTurnId?: string } = {}): DevCodexQueueProcessor & {
  started?: { threadId: string; message: StoredQueuedMessage; options?: { cwd?: string; resume?: boolean } }
} {
  const processor: DevCodexQueueProcessor & {
    started?: { threadId: string; message: StoredQueuedMessage; options?: { cwd?: string; resume?: boolean } }
  } = {
    processThreadQueue: async () => undefined,
    startMessageTurn: async (threadId, queuedMessage, startOptions) => {
      processor.started = { threadId, message: queuedMessage, options: startOptions }
      return options.startedTurnId ?? 'turn-started'
    },
  }
  return processor
}

function dependencies(queue: StoredQueuedMessage[] = []) {
  return {
    readPermissions: async () => ({ defaultPreset: 'workspace' as const, threadPresets: { 'thread-1': 'fullAccess' as const } }),
    appendQueuedMessage: async (_threadId: string, queuedMessage: StoredQueuedMessage) => { queue.push(queuedMessage) },
    readQueueState: async (): Promise<Record<string, StoredQueuedMessage[]>> => queue.length > 0 ? { 'thread-1': queue } : {},
  }
}

function queueDependencies(queue: StoredQueuedMessage[]) {
  return { readQueueState: async () => ({ 'thread-1': queue }) }
}

function message(id: string): StoredQueuedMessage {
  return {
    id,
    text: id,
    imageUrls: [],
    skills: [],
    fileAttachments: [],
    collaborationMode: 'default',
    permissionPreset: 'workspace',
  }
}
