import { afterEach, describe, expect, it, vi } from 'vitest'

const resolutionMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  spawnSyncCommand: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: resolutionMocks.existsSync,
}))

vi.mock('./utils/commandInvocation.js', () => ({
  spawnSyncCommand: resolutionMocks.spawnSyncCommand,
}))

import { canRunCommand, resolveCodexCommand } from './commandResolution'

describe('Windows Codex command resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resolutionMocks.existsSync.mockReset()
    resolutionMocks.spawnSyncCommand.mockReset()
  })

  it('probes commands through the shared spawn wrapper', () => {
    resolutionMocks.spawnSyncCommand.mockReturnValue({ status: 0 })

    expect(canRunCommand('codex', ['--version'])).toBe(true)
    expect(resolutionMocks.spawnSyncCommand).toHaveBeenCalledWith('codex', ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  })

  it('resolves the bundled executable from vendor bin on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('npm_config_prefix', 'C:\\npm-global')
    vi.stubEnv('PREFIX', '')
    vi.stubEnv('APPDATA', '')
    vi.stubEnv('CODEXUI_CODEX_COMMAND', '')
    const bundledCodex = 'C:\\npm-global\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe'
    resolutionMocks.existsSync.mockImplementation((candidate) => candidate === bundledCodex)
    resolutionMocks.spawnSyncCommand.mockImplementation((command) => ({
      status: command === bundledCodex ? 0 : 1,
    }))

    expect(resolveCodexCommand()).toBe(bundledCodex)
    expect(resolutionMocks.spawnSyncCommand).toHaveBeenCalledWith(bundledCodex, ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  })
})
