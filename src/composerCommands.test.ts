import { describe, expect, it } from 'vitest'
import { getComposerCommandQuery, parseComposerCommand } from './composerCommands'

describe('composer commands', () => {
  it('parses plan mode with or without an inline prompt', () => {
    expect(parseComposerCommand('/plan')).toEqual({ name: 'plan', argument: '' })
    expect(parseComposerCommand('/PLAN inspect this bug')).toEqual({ name: 'plan', argument: 'inspect this bug' })
  })

  it('accepts semantic review scopes and never sends an unknown review argument as a prompt', () => {
    expect(parseComposerCommand('/review')).toEqual({ name: 'review' })
    expect(parseComposerCommand('/review uncommitted')).toEqual({ name: 'review', target: { type: 'uncommittedChanges' } })
    expect(parseComposerCommand('/review branch origin/main')).toEqual({ name: 'review', target: { type: 'baseBranch', branch: 'origin/main' } })
    expect(parseComposerCommand('/review commit abcd1234')).toEqual({ name: 'review', target: { type: 'commit', sha: 'abcd1234' } })
    expect(parseComposerCommand('/review staged files')).toEqual({ name: 'review' })
  })

  it('recognizes supported action commands without swallowing ordinary prompts', () => {
    for (const name of ['compact', 'fork', 'status', 'fast'] as const) {
      expect(parseComposerCommand(`/${name}`)).toEqual({ name })
      expect(parseComposerCommand(`/${name} something else`)).toBe(null)
    }
  })

  it('parses current-chat memory controls', () => {
    expect(parseComposerCommand('/memories')).toEqual({ name: 'memories' })
    expect(parseComposerCommand('/memories use on')).toEqual({ name: 'memories', setting: 'use', value: true })
    expect(parseComposerCommand('/memories generate off')).toEqual({ name: 'memories', setting: 'generate', value: false })
    expect(parseComposerCommand('/memories unknown')).toBe(null)
  })

  it('reads persistent goals without accepting unrelated slash prompts', () => {
    expect(parseComposerCommand('/goal')).toEqual({ name: 'goal', argument: '' })
    expect(parseComposerCommand('/GOAL ship the release')).toEqual({ name: 'goal', argument: 'ship the release' })
    expect(parseComposerCommand('/goal clear')).toEqual({ name: 'goal', argument: 'clear' })
  })

  it('does not intercept ordinary slash text', () => {
    expect(parseComposerCommand('please run /plan')).toBe(null)
    expect(parseComposerCommand('/unknown')).toBe(null)
    expect(getComposerCommandQuery('/rev')).toBe('rev')
    expect(getComposerCommandQuery('/plan next')).toBe(null)
  })
})
