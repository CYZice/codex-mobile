import { describe, expect, it } from 'vitest'
import { readUpstreamModelReport } from './upstreamModelReport'

describe('upstream response model notifications', () => {
  const notification = (method: string, params: unknown) => ({ method, params, atIso: '2026-09-21T00:00:00Z' })

  it('reads only the explicitly reported response.model', () => {
    expect(readUpstreamModelReport(notification('codexMobile/upstreamModelReported', {
      threadId: 'thread-a', turnId: 'turn-a', model: 'gpt-5.6-terra',
      responseId: 'resp_A', phase: 'created',
    }))).toEqual({
      threadId: 'thread-a', turnId: 'turn-a', model: 'gpt-5.6-terra',
      responseId: 'resp_A', phase: 'created',
    })
  })

  it('rejects requested model, malformed reports, and other notifications', () => {
    expect(readUpstreamModelReport(notification('model/rerouted', { model: 'gpt-5.6-terra' }))).toBeNull()
    expect(readUpstreamModelReport(notification('codexMobile/upstreamModelReported', {
      threadId: 'a', turnId: 'b', model: 'gpt-5.6-terra', responseId: 'resp', phase: 'unknown',
    }))).toBeNull()
  })
})
