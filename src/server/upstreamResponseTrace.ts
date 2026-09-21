/** Extract only upstream-declared model metadata from Codex's SSE TRACE output.
 * Never retain or forward the raw response payload: it may contain conversation text.
 */
export type UpstreamResponseModel = {
  model: string
  responseId: string
  phase: 'created' | 'completed'
}

/** TRACE has no thread/turn IDs; only a single active turn is unambiguous. */
export function uniqueTraceTurn(activeTurnKeys: ReadonlySet<string>): { threadId: string; turnId: string } | null {
  if (activeTurnKeys.size !== 1) return null
  const [key] = activeTurnKeys
  const split = key.lastIndexOf(':')
  if (split <= 0) return null
  const threadId = key.slice(0, split)
  const turnId = key.slice(split + 1)
  return threadId && turnId && turnId !== 'active' ? { threadId, turnId } : null
}

const MAX_LINE_LENGTH = 1_000_000
const TRACE_TARGET = 'codex_api::sse::responses'

export function parseUpstreamResponseTraceLine(line: string): UpstreamResponseModel | null {
  if (!line.includes(TRACE_TARGET)) return null
  // TRACE describes a serialized SSE event, not an app-server RPC notification.
  const created = line.indexOf('{"type":"response.created"')
  const completed = line.indexOf('{"type":"response.completed"')
  const start = created >= 0 ? created : completed
  if (start < 0) return null
  try {
    const event = JSON.parse(line.slice(start)) as unknown
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null
    const record = event as Record<string, unknown>
    if (record.type !== 'response.created' && record.type !== 'response.completed') return null
    const response = record.response
    if (!response || typeof response !== 'object' || Array.isArray(response)) return null
    const { model, id } = response as Record<string, unknown>
    if (typeof model !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/u.test(model)) return null
    return {
      model,
      responseId: typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/u.test(id) ? id : '',
      phase: record.type === 'response.created' ? 'created' : 'completed',
    }
  } catch {
    return null
  }
}

export class UpstreamResponseTraceReader {
  private pending = ''
  private discardingLine = false

  /** Returns non-TRACE stderr lines only. The caller must not log the input chunk. */
  ingest(chunk: string, onModel: (report: UpstreamResponseModel) => void): string {
    let safeOutput = ''
    let offset = 0
    while (offset < chunk.length) {
      const newline = chunk.indexOf('\n', offset)
      const end = newline < 0 ? chunk.length : newline
      const segment = chunk.slice(offset, end)
      if (!this.discardingLine) {
        if (this.pending.length + segment.length > MAX_LINE_LENGTH) {
          this.pending = ''
          this.discardingLine = true
        } else {
          this.pending += segment
        }
      }
      if (newline < 0) break
      if (!this.discardingLine) {
        const line = this.pending.replace(/\r$/u, '')
        if (line.includes(TRACE_TARGET) || /\bTRACE\b/u.test(line)) {
          const report = parseUpstreamResponseTraceLine(line)
          if (report) onModel(report)
        } else {
          safeOutput += `${line}\n`
        }
      }
      this.pending = ''
      this.discardingLine = false
      offset = newline + 1
    }
    return safeOutput
  }

  reset(): void {
    this.pending = ''
    this.discardingLine = false
  }
}
