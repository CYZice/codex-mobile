import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('workspace roots state cache', () => {
  it('deduplicates concurrent reads and revalidates after the short cache window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          order: ['/first'],
          labels: {},
          active: ['/first'],
          projectOrder: ['/first'],
          remoteProjects: [],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          order: ['/second'],
          labels: {},
          active: ['/second'],
          projectOrder: ['/second'],
          remoteProjects: [],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const { getWorkspaceRootsState } = await import('./codexGateway')

    const [first, concurrent] = await Promise.all([
      getWorkspaceRootsState(),
      getWorkspaceRootsState(),
    ])
    expect(first.order).toEqual(['/first'])
    expect(concurrent.order).toEqual(['/first'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenLastCalledWith('/codex-api/workspace-roots-state', { cache: 'no-store' })

    vi.advanceTimersByTime(1_999)
    expect((await getWorkspaceRootsState()).order).toEqual(['/first'])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2)
    expect((await getWorkspaceRootsState()).order).toEqual(['/second'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
