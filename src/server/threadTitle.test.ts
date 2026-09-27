import { describe, expect, it } from 'vitest'
import {
  buildAutomaticThreadTitlePrompt,
  isAutomaticThreadTitleEligible,
  parseStructuredThreadTitle,
  readCompletedUserMessageForTitle,
  shouldApplyAutomaticThreadTitle,
  THREAD_TITLE_MAX_CHARS,
  THREAD_TITLE_PROMPT_MAX_BYTES,
} from './threadTitle.js'

describe('thread title helpers', () => {
  it('builds the official-style bounded title prompt without splitting Unicode', () => {
    const prompt = buildAutomaticThreadTitlePrompt(`  ${'汉'.repeat(1000)}  `)
    expect(Buffer.byteLength(prompt, 'utf8')).toBeLessThanOrEqual(THREAD_TITLE_PROMPT_MAX_BYTES)
    expect(prompt).toContain('Write in the user\'s language.')
    expect(prompt).toContain('User prompt:')
  })

  it('accepts only structured title output and normalizes it', () => {
    expect(parseStructuredThreadTitle('{"title":"  Fix login form.  "}')).toBe('Fix login form')
    expect(parseStructuredThreadTitle('Fix login form')).toBeNull()
    expect(parseStructuredThreadTitle('{"title":"ok","extra":1}')).toBeNull()
    expect(parseStructuredThreadTitle(JSON.stringify({ title: 'x'.repeat(100) }))?.length).toBe(THREAD_TITLE_MAX_CHARS)
  })

  it('extracts only completed user-message text', () => {
    expect(readCompletedUserMessageForTitle({
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        item: { type: 'userMessage', content: [{ type: 'text', text: 'Fix the title flow' }] },
      },
    })).toEqual({ threadId: 'thread-1', prompt: 'Fix the title flow' })
    expect(readCompletedUserMessageForTitle({
      method: 'item/completed',
      params: { threadId: 'thread-1', item: { type: 'agentMessage', text: 'done' } },
    })).toBeNull()
  })

  it('only auto-titles ordinary persistent user threads without a name', () => {
    expect(isAutomaticThreadTitleEligible({ name: null, ephemeral: false, threadSource: null })).toBe(true)
    expect(isAutomaticThreadTitleEligible({ name: null, ephemeral: false, threadSource: 'user' })).toBe(true)
    expect(isAutomaticThreadTitleEligible({ name: 'Manual title', ephemeral: false, threadSource: 'user' })).toBe(false)
    expect(isAutomaticThreadTitleEligible({ name: null, ephemeral: true, threadSource: 'user' })).toBe(false)
    expect(isAutomaticThreadTitleEligible({ name: null, ephemeral: false, threadSource: 'review' })).toBe(false)
    expect(isAutomaticThreadTitleEligible({ name: null, ephemeral: false, threadSource: 'thread_title' })).toBe(false)
  })

  it('never applies an automatic result after a manual rename wins the race', () => {
    expect(shouldApplyAutomaticThreadTitle(null, false)).toBe(true)
    expect(shouldApplyAutomaticThreadTitle(null, true)).toBe(false)
    expect(shouldApplyAutomaticThreadTitle('Manual title', false)).toBe(false)
    expect(shouldApplyAutomaticThreadTitle('Manual title', true)).toBe(false)
  })
})
