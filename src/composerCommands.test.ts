import { describe, expect, it } from 'vitest'
import { getComposerCommandQuery, parseComposerCommand } from './composerCommands'

describe('composer commands', () => {
  it('parses plan mode with or without an inline prompt', () => {
    expect(parseComposerCommand('/plan')).toEqual({ name: 'plan', argument: '' })
    expect(parseComposerCommand('/PLAN inspect this bug')).toEqual({ name: 'plan', argument: 'inspect this bug' })
  })

  it('only accepts review without arguments', () => {
    expect(parseComposerCommand('/review')).toEqual({ name: 'review' })
    expect(parseComposerCommand('/review staged files')).toBe(null)
  })

  it('does not intercept ordinary slash text', () => {
    expect(parseComposerCommand('please run /plan')).toBe(null)
    expect(parseComposerCommand('/unknown')).toBe(null)
    expect(getComposerCommandQuery('/rev')).toBe('rev')
    expect(getComposerCommandQuery('/plan next')).toBe(null)
  })
})
