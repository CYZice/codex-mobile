import { describe, expect, it } from 'vitest'
import { parseUpstreamResponseTraceLine, uniqueTraceTurn, UpstreamResponseTraceReader } from './upstreamResponseTrace'

const event = (type: string, model: string, responseId = 'resp_A') =>
  `2026-09-21T00:00:00Z TRACE codex_api::sse::responses: SSE event: ${JSON.stringify({
    type, response: { id: responseId, model, output: [{ type: 'message', content: 'private content' }] },
  })}`

describe('Codex upstream response TRACE', () => {
  it('attributes only when exactly one identified turn is active', () => {
    expect(uniqueTraceTurn(new Set(['thread-a:turn-a']))).toEqual({ threadId: 'thread-a', turnId: 'turn-a' })
    expect(uniqueTraceTurn(new Set())).toBeNull()
    expect(uniqueTraceTurn(new Set(['thread-a:turn-a', 'thread-b:turn-b']))).toBeNull()
    expect(uniqueTraceTurn(new Set(['thread-a:active']))).toBeNull()
  })
  it('reads actual response.created and response.completed model fields', () => {
    expect(parseUpstreamResponseTraceLine(event('response.created', 'gpt-5.6-sol'))).toEqual({
      model: 'gpt-5.6-sol', responseId: 'resp_A', phase: 'created',
    })
    expect(parseUpstreamResponseTraceLine(event('response.completed', 'gpt-5.6-terra'))?.model).toBe('gpt-5.6-terra')
  })

  it('rejects guessed models and malformed or unrelated events', () => {
    expect(parseUpstreamResponseTraceLine('turn_context.model=gpt-5.6-sol')).toBeNull()
    expect(parseUpstreamResponseTraceLine(event('response.output_text.delta', 'gpt-5.6-sol'))).toBeNull()
    expect(parseUpstreamResponseTraceLine('TRACE codex_api::sse::responses: {"type":"response.created","response":{"model":42}}')).toBeNull()
  })

  it('handles split stderr frames and never returns raw TRACE content to diagnostics', () => {
    const reader = new UpstreamResponseTraceReader()
    const observed: string[] = []
    const line = `${event('response.created', 'gpt-5.6-sol')}\n`
    expect(reader.ingest(line.slice(0, 30), result => observed.push(result.model))).toBe('')
    expect(reader.ingest(line.slice(30) + 'ordinary warning\n', result => observed.push(result.model))).toBe('ordinary warning\n')
    expect(observed).toEqual(['gpt-5.6-sol'])
  })

  it('discards oversized TRACE lines without retaining raw content', () => {
    const reader = new UpstreamResponseTraceReader()
    const models: string[] = []
    expect(reader.ingest('TRACE ' + 'x'.repeat(1_000_001) + '\n', result => models.push(result.model))).toBe('')
    expect(reader.ingest(`${event('response.created', 'gpt-5.6-sol')}\n`, result => models.push(result.model))).toBe('')
    expect(models).toEqual(['gpt-5.6-sol'])
  })
})
