import { describe, expect, it } from 'vitest'
import { DIAGNOSTICS_MAX_EVENTS, DIAGNOSTICS_MAX_STDERR, RuntimeDiagnostics, redactDiagnosticText } from './runtimeDiagnostics'

describe('runtime diagnostics', () => {
  it('redacts credentials and paths', () => {
    const value = redactDiagnosticText('Authorization: Bearer abc123 token=secret C:/Users/me/prompt.txt')
    expect(value).not.toContain('abc123')
    expect(value).not.toContain('secret')
    expect(value).not.toContain('prompt.txt')
    expect(value).toContain('[redacted]')
  })

  it('bounds the event ring and stderr tail', () => {
    const diagnostics = new RuntimeDiagnostics()
    for (let index = 0; index < DIAGNOSTICS_MAX_EVENTS + 10; index += 1) diagnostics.record('event', { index })
    diagnostics.appendStderr('x'.repeat(DIAGNOSTICS_MAX_STDERR + 100))
    const snapshot = diagnostics.snapshot()
    expect(snapshot.recentEvents).toHaveLength(DIAGNOSTICS_MAX_EVENTS)
    expect(snapshot.stderrTail).toHaveLength(DIAGNOSTICS_MAX_STDERR)
  })
})
