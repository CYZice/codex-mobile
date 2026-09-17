import { describe, expect, it } from 'vitest'
import { readModelReroute } from './modelReroute'

const notification = (method: string, params: unknown) => ({ method, params, atIso: '2026-09-17T00:00:00Z' })

describe('readModelReroute', () => {
  it('accepts only an explicit app-server reroute with its turn and model names', () => {
    expect(readModelReroute(notification('model/rerouted', {
      threadId: ' thread-a ', turnId: ' turn-1 ', fromModel: ' gpt-6-astra ', toModel: ' gpt-5.6-sol ',
      reason: 'highRiskCyberActivity',
    }))).toEqual({
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
    })
  })

  it('never treats selected-model metadata or malformed events as upstream evidence', () => {
    expect(readModelReroute(notification('thread/settings/updated', {
      threadId: 'thread-a', model: 'gpt-6-astra',
    }))).toBeNull()
    expect(readModelReroute(notification('model/rerouted', {
      threadId: 'thread-a', turnId: 'turn-1', fromModel: 'gpt-6-astra',
    }))).toBeNull()
    expect(readModelReroute(notification('model/rerouted', {
      threadId: 'thread-a', turnId: '', fromModel: 'gpt-6-astra', toModel: 'gpt-5.6-sol',
    }))).toBeNull()
  })
})
