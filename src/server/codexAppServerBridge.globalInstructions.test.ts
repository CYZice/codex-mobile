import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readGlobalInstructions, writeGlobalInstructions } from './codexAppServerBridge'

const originalCodexHome = process.env.CODEX_HOME
const temporaryHomes: string[] = []

async function createCodexHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'codex-global-instructions-'))
  temporaryHomes.push(home)
  process.env.CODEX_HOME = home
  return home
}

afterEach(async () => {
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalCodexHome
  await Promise.all(temporaryHomes.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('global AGENTS.md instructions', () => {
  it('reads and writes a regular AGENTS.md file', async () => {
    const home = await createCodexHome()
    await writeFile(join(home, 'AGENTS.md'), '# Existing\n', 'utf8')

    expect((await readGlobalInstructions()).content).toBe('# Existing\n')
    const saved = await writeGlobalInstructions('# Updated\n')

    expect(saved.content).toBe('# Updated\n')
    expect(saved.effectiveSource).toBe('AGENTS.md')
    expect(await readFile(join(home, 'AGENTS.md'), 'utf8')).toBe('# Updated\n')
  })

  it.skipIf(process.platform === 'win32')('preserves an AGENTS.md symbolic link and writes through to its target', async () => {
    const home = await createCodexHome()
    const targetDir = join(home, 'skills')
    const target = join(targetDir, 'AGENTS.md')
    const link = join(home, 'AGENTS.md')
    await mkdir(targetDir, { recursive: true })
    await writeFile(target, '# Linked\n', 'utf8')
    await symlink(target, link, 'file')

    const saved = await writeGlobalInstructions('# Updated target\n')

    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readFile(target, 'utf8')).toBe('# Updated target\n')
    expect(saved.isSymlink).toBe(true)
    expect(saved.targetPath).toBe(target)
  })

  it('reports a non-empty override as the effective source and ignores an empty override', async () => {
    const home = await createCodexHome()
    await writeFile(join(home, 'AGENTS.md'), '# Base\n', 'utf8')
    await writeFile(join(home, 'AGENTS.override.md'), '# Override\n', 'utf8')

    expect(await readGlobalInstructions()).toMatchObject({
      overrideActive: true,
      effectiveSource: 'AGENTS.override.md',
    })

    await writeFile(join(home, 'AGENTS.override.md'), '  \n', 'utf8')
    expect(await readGlobalInstructions()).toMatchObject({
      overrideActive: false,
      effectiveSource: 'AGENTS.md',
    })
  })

  it('accepts empty instructions and creates CODEX_HOME when missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codex-global-instructions-root-'))
    temporaryHomes.push(root)
    const home = join(root, 'nested', '.codex')
    process.env.CODEX_HOME = home

    const saved = await writeGlobalInstructions('')

    expect(saved.content).toBe('')
    expect(saved.effectiveSource).toBe('none')
    expect(await readFile(join(home, 'AGENTS.md'), 'utf8')).toBe('')
  })
})
