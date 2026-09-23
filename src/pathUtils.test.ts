import { describe, expect, it } from 'vitest'
import { isProjectlessChatPath, isProjectlessThreadCwd } from './pathUtils'

describe('chat versus project classification', () => {
  it('recognizes generated chats with Windows device prefixes and case variations', () => {
    expect(isProjectlessThreadCwd('')).toBe(true)
    expect(isProjectlessThreadCwd('  ')).toBe(true)
    expect(isProjectlessThreadCwd('\\\\?\\C:\\Users\\test\\Documents\\Codex\\2026-09-23\\new-chat')).toBe(true)
    expect(isProjectlessThreadCwd('C:/Users/test/documents/codex/2026-09-23/new-chat')).toBe(true)
    expect(isProjectlessChatPath('C:/repo/ordinary-project')).toBe(false)
    expect(isProjectlessThreadCwd('C:/repo/ordinary-project')).toBe(false)
  })
})
