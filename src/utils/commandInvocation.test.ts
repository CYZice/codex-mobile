import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSpawnInvocation } from './commandInvocation'

describe('getSpawnInvocation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes the bare Codex npm shim through cmd.exe on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

    expect(getSpawnInvocation('codex', ['--version'])).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'codex --version'],
    })
  })

  it('executes a bundled Windows executable directly', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

    expect(getSpawnInvocation('C:\\codex\\bin\\codex.exe', ['app-server'])).toEqual({
      command: 'C:\\codex\\bin\\codex.exe',
      args: ['app-server'],
    })
  })
})
