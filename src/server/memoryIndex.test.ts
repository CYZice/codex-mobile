import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readMemoryIndex } from './memoryIndex.js'

describe.sequential('memory preview index', () => {
  const previousHome = process.env.CODEX_HOME
  let home = ''

  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true })
    if (previousHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = previousHome
  })

  it('prefers memory_summary.md topics over raw MEMORY.md topics', () => {
    home = mkdtempSync(join(tmpdir(), 'codex-memory-preview-'))
    process.env.CODEX_HOME = home
    const root = join(home, 'memories')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'memory_summary.md'), '# Summary A\nAlpha detail\n## Summary B\nBeta detail\n')
    writeFileSync(join(root, 'MEMORY.md'), '# Raw A\nRaw detail\n# Raw B\nMore raw detail\n')

    const index = readMemoryIndex()
    expect(index.files).toHaveLength(2)
    expect(index.topics.map((topic) => topic.title)).toEqual(['Summary A', 'Summary B'])
    expect(index.topics.every((topic) => topic.sourceFile.endsWith('memory_summary.md'))).toBe(true)
  })

  it('falls back to MEMORY.md when the summary file is absent', () => {
    home = mkdtempSync(join(tmpdir(), 'codex-memory-preview-'))
    process.env.CODEX_HOME = home
    const root = join(home, 'memories')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'MEMORY.md'), '# Raw A\nRaw detail\n# Raw B\nMore raw detail\n')

    const index = readMemoryIndex()
    expect(index.topics.map((topic) => topic.title)).toEqual(['Raw A', 'Raw B'])
  })
})
