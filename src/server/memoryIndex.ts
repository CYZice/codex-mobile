import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'

export type MemoryTopic = {
  id: string
  title: string
  summary: string
  keywords: string[]
  sourceFile: string
  updatedAt: string
  line: number
}

export type MemoryIndex = {
  rootPath: string
  scannedAt: string
  topics: MemoryTopic[]
  files: Array<{ path: string; size: number; updatedAt: string }>
  errors: string[]
}

const memoryRoot = () => {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  return join(codexHome, 'memories')
}

function extractKeywords(body: string): string[] {
  const latin = body.match(/[A-Za-z][A-Za-z0-9_-]{2,}/gu) ?? []
  const cjk = body.match(/[\p{Script=Han}]{2,8}/gu) ?? []
  return [...new Set([...latin, ...cjk])].slice(0, 12)
}

function pushTopic(
  topics: MemoryTopic[],
  fileName: string,
  sourceFile: string,
  updatedAt: string,
  title: string,
  startLineIndex: number,
  bodyLines: string[],
) {
  const summary = bodyLines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .slice(0, 3)
    .join(' ')
    .trim()

  topics.push({
    id: `${fileName}:${startLineIndex}`,
    title,
    summary: summary.slice(0, 360),
    keywords: extractKeywords(summary),
    sourceFile,
    updatedAt,
    line: startLineIndex + 1,
  })
}

export function readMemoryIndex(): MemoryIndex {
  const rootPath = memoryRoot()
  const topics: MemoryTopic[] = []
  const files: MemoryIndex['files'] = []
  const errors: string[] = []
  const preferredTopicFile = existsSync(join(rootPath, 'memory_summary.md')) ? 'memory_summary.md' : 'MEMORY.md'

  for (const fileName of ['memory_summary.md', 'MEMORY.md']) {
    const sourceFile = join(rootPath, fileName)
    if (!existsSync(sourceFile)) continue

    try {
      const stat = statSync(sourceFile)
      const updatedAt = stat.mtime.toISOString()
      files.push({ path: sourceFile, size: stat.size, updatedAt })
      if (fileName !== preferredTopicFile) continue
      const lines = readFileSync(sourceFile, 'utf8').split(/\r?\n/u)

      let title = ''
      let startLineIndex = 0
      for (let index = 0; index < lines.length; index += 1) {
        const heading = lines[index]?.match(/^#{1,3}\s+(.+)/u)
        if (!heading) continue
        if (title) {
          pushTopic(topics, fileName, sourceFile, updatedAt, title, startLineIndex, lines.slice(startLineIndex, index))
        }
        title = heading[1]?.trim() || 'Untitled memory'
        startLineIndex = index + 1
      }

      if (title) {
        pushTopic(topics, fileName, sourceFile, updatedAt, title, startLineIndex, lines.slice(startLineIndex))
      }
    } catch (error) {
      errors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { rootPath, scannedAt: new Date().toISOString(), topics, files, errors }
}

export function readMemoryFile(rawPath: string): { path: string; content: string } {
  const rootPath = resolve(memoryRoot())
  const fullPath = resolve(rawPath && rawPath.startsWith(rootPath) ? rawPath : join(rootPath, rawPath))
  const relativePath = relative(rootPath, fullPath)
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath) || !fullPath.toLowerCase().endsWith('.md')) {
    throw new Error('Memory file is outside the memory directory')
  }
  if (!existsSync(fullPath)) throw new Error('Memory file not found')
  return { path: fullPath, content: readFileSync(fullPath, 'utf8') }
}
