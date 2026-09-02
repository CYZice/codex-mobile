import { describe, expect, it } from 'vitest'
import type { UiMessage } from '../../types/codex'
import { groupWorkedTurnActivity } from './turnActivityCollapse'

function message(overrides: Partial<UiMessage> & Pick<UiMessage, 'id' | 'role' | 'text'>): UiMessage {
  return overrides
}

describe('groupWorkedTurnActivity', () => {
  it('groups every activity record before worked and keeps the final summary outside', () => {
    const groups = groupWorkedTurnActivity([
      message({ id: 'user-1', role: 'user', text: 'Implement this' }),
      message({ id: 'plan-1', role: 'assistant', text: 'Plan', messageType: 'plan' }),
      message({ id: 'command-1', role: 'system', text: 'rg', messageType: 'commandExecution' }),
      message({ id: 'files-1', role: 'system', text: '', messageType: 'fileChange' }),
      message({ id: 'compaction-1', role: 'system', text: 'Context automatically compacted', messageType: 'contextCompaction' }),
      message({ id: 'worked-1', role: 'system', text: 'Worked for 1m', messageType: 'worked' }),
      message({ id: 'assistant-1', role: 'assistant', text: 'Implemented.', messageType: 'agentMessage' }),
    ])

    expect(groups['worked-1']).toEqual({
      activityMessageIds: ['plan-1', 'command-1', 'files-1', 'compaction-1'],
      hasFinalAssistantMessage: true,
    })
  })

  it('keeps adjacent turns isolated and does not collapse unfinished turns', () => {
    const groups = groupWorkedTurnActivity([
      message({ id: 'user-1', role: 'user', text: 'First request' }),
      message({ id: 'command-1', role: 'system', text: 'rg', messageType: 'commandExecution' }),
      message({ id: 'worked-1', role: 'system', text: 'Worked for 1s', messageType: 'worked' }),
      message({ id: 'assistant-1', role: 'assistant', text: 'First result', messageType: 'agentMessage' }),
      message({ id: 'user-2', role: 'user', text: 'Second request' }),
      message({ id: 'plan-2', role: 'assistant', text: 'Plan', messageType: 'plan.live' }),
      message({ id: 'worked-2', role: 'system', text: 'Worked for 2s', messageType: 'worked' }),
      message({ id: 'assistant-2', role: 'assistant', text: 'Still responding', messageType: 'agentMessage.live' }),
    ])

    expect(groups['worked-1']).toEqual({
      activityMessageIds: ['command-1'],
      hasFinalAssistantMessage: true,
    })
    expect(groups['worked-2']).toEqual({
      activityMessageIds: ['plan-2'],
      hasFinalAssistantMessage: false,
    })
  })
})
