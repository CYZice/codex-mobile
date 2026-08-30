import { describe, expect, it } from 'vitest'

import { buildProjectlessFolderName, buildProjectlessPromptSlug } from './codexAppServerBridge'

describe('projectless chat folder naming', () => {
  it('builds Desktop-compatible slugs from the first six alphanumeric tokens', () => {
    expect(buildProjectlessPromptSlug('Build a Small API for My Demo Today')).toBe('build-a-small-api-for-my')
    expect(buildProjectlessPromptSlug('你好，帮我分析一下')).toBe('new-chat')
    expect(buildProjectlessPromptSlug(null)).toBe('new-chat')
  })

  it('uses readable collision suffixes before switching to a unique suffix', () => {
    expect(buildProjectlessFolderName('new-chat', 0, 'fixed')).toBe('new-chat')
    expect(buildProjectlessFolderName('new-chat', 1, 'fixed')).toBe('new-chat-2')
    expect(buildProjectlessFolderName('new-chat', 19, 'fixed')).toBe('new-chat-20')
    expect(buildProjectlessFolderName('new-chat', 20, 'fixed')).toBe('new-chat-fixed')
  })
})
