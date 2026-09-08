import { afterEach, describe, expect, it, vi } from 'vitest'

const rpcCall = vi.hoisted(() => vi.fn())

vi.mock('./codexRpcClient', () => ({
  fetchPendingServerRequests: vi.fn(),
  fetchRpcMethodCatalog: vi.fn(),
  fetchRpcNotificationCatalog: vi.fn(),
  respondServerRequest: vi.fn(),
  rpcCall,
  subscribeRpcNotifications: vi.fn(),
}))

afterEach(() => {
  rpcCall.mockReset()
})

describe('startThread', () => {
  it('sends the Desktop projectless workspace fields to thread/start', async () => {
    rpcCall.mockResolvedValue({
      thread: { id: 'thread-1', cwd: 'C:/Users/test/Documents/Codex/2026-08-30/new-chat' },
      model: 'gpt-5.6-terra',
    })
    const { startThread } = await import('./codexGateway')

    await startThread({
      cwd: ' C:/Users/test/Documents/Codex/2026-08-30/new-chat ',
      outputDirectory: ' C:/Users/test/Documents/Codex/2026-08-30/new-chat ',
      workspaceRoot: ' C:/Users/test/Documents/Codex ',
      model: ' gpt-5.6-terra ',
    })

    expect(rpcCall).toHaveBeenCalledWith('thread/start', {
      cwd: 'C:/Users/test/Documents/Codex/2026-08-30/new-chat',
      outputDirectory: 'C:/Users/test/Documents/Codex/2026-08-30/new-chat',
      workspaceRoot: 'C:/Users/test/Documents/Codex',
      model: 'gpt-5.6-terra',
      dynamicTools: [expect.objectContaining({ name: 'read_thread' })],
    }, undefined)
  })
})
