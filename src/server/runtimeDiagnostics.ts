import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const DIAGNOSTICS_MAX_EVENTS = 120
export const DIAGNOSTICS_MAX_STDERR = 8 * 1024
export const DIAGNOSTICS_MAX_LOG_BYTES = 1024 * 1024
const DIAGNOSTICS_BACKUPS = 4

export type RuntimeDiagnosticEvent = {
  atIso: string
  kind: string
  detail?: Record<string, unknown>
}

export type RuntimeDiagnosticsSnapshot = {
  appServer: {
    lifecycle: 'idle' | 'starting' | 'ready'
    generation: number
    pid: number | null
    startedAtIso: string | null
    initializedAtIso: string | null
    command: string | null
    sandbox: string | null
    approval: string | null
    memories: boolean | null
    pendingRpcCount: number
    activeTurnCount: number
    pendingServerRequestCount: number
    lastExit: { atIso: string; code: number | null; signal: string | null } | null
    lastReload: { atIso: string; cause: string } | null
    lastError: { atIso: string; message: string } | null
  }
  stderrTail: string
  recentEvents: RuntimeDiagnosticEvent[]
  websocket: { activeSubscribers: number; totalConnections: number; lastEvent: RuntimeDiagnosticEvent | null }
  log: { enabled: true; currentBytes: number; backupCount: number; maxBytes: number }
}

function codexHome(): string {
  return process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
}

export function redactDiagnosticText(value: unknown, max = 600): string {
  let text = value instanceof Error ? value.message : typeof value === 'string' ? value : String(value)
  text = text.replace(/(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/giu, '[redacted]')
  text = text.replace(/(?:token|secret|password|passwd|api[_-]?key|authorization|cookie|credential)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]')
  text = text.replace(/(?:[A-Za-z]:\\|\\\\|\/Users\/|\/home\/|\/tmp\/|\/var\/)[^\s"']+/gu, '[path]')
  text = text.replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text
}

export function hashDiagnosticThreadId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export class RuntimeDiagnostics {
  private readonly events: RuntimeDiagnosticEvent[] = []
  private stderrTail = ''
  private writeQueue = Promise.resolve()
  private warnedPersistence = false
  private currentBytes = 0
  private backupCount = 0
  private websocketActive = 0
  private websocketTotal = 0
  private websocketLastEvent: RuntimeDiagnosticEvent | null = null
  private readonly state: RuntimeDiagnosticsSnapshot['appServer'] = {
    lifecycle: 'idle', generation: 0, pid: null, startedAtIso: null, initializedAtIso: null,
    command: null, sandbox: null, approval: null, memories: null, pendingRpcCount: 0,
    activeTurnCount: 0, pendingServerRequestCount: 0, lastExit: null, lastReload: null, lastError: null,
  }

  private get logDir(): string { return join(codexHome(), 'codex-mobile', 'diagnostics') }
  private get logFile(): string { return join(this.logDir, 'runtime.jsonl') }

  record(kind: string, detail?: Record<string, unknown>): void {
    const sanitizedDetail = detail ? Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, typeof value === 'string' ? redactDiagnosticText(value, 400) : value])) : undefined
    const event: RuntimeDiagnosticEvent = { atIso: new Date().toISOString(), kind, ...(sanitizedDetail ? { detail: sanitizedDetail } : {}) }
    this.events.unshift(event)
    if (this.events.length > DIAGNOSTICS_MAX_EVENTS) this.events.length = DIAGNOSTICS_MAX_EVENTS
    this.writeQueue = this.writeQueue.then(() => this.persist(event)).catch((error) => {
      if (!this.warnedPersistence) {
        this.warnedPersistence = true
        console.warn('[diagnostics] persistence unavailable:', redactDiagnosticText(error))
      }
    })
  }

  private async persist(event: RuntimeDiagnosticEvent): Promise<void> {
    await mkdir(this.logDir, { recursive: true })
    const info = await stat(this.logFile).catch(() => null)
    this.currentBytes = info?.size ?? 0
    const line = `${JSON.stringify(event)}\n`
    if (this.currentBytes + Buffer.byteLength(line) > DIAGNOSTICS_MAX_LOG_BYTES) {
      for (let index = DIAGNOSTICS_BACKUPS - 1; index >= 1; index -= 1) {
        await rename(join(this.logDir, `runtime.jsonl.${index}`), join(this.logDir, `runtime.jsonl.${index + 1}`)).catch(() => {})
      }
      await rename(this.logFile, join(this.logDir, 'runtime.jsonl.1')).catch(() => {})
      this.currentBytes = 0
      this.backupCount = Math.min(DIAGNOSTICS_BACKUPS, this.backupCount + 1)
    }
    await appendFile(this.logFile, line, 'utf8')
    this.currentBytes += Buffer.byteLength(line)
  }

  setAppServerState(update: Partial<RuntimeDiagnosticsSnapshot['appServer']>): void { Object.assign(this.state, update) }
  appendStderr(chunk: unknown): void {
    this.stderrTail = `${this.stderrTail}${typeof chunk === 'string' ? chunk : String(chunk)}`.slice(-DIAGNOSTICS_MAX_STDERR)
  }
  websocket(event: 'open' | 'close' | 'error' | 'reconnect' | 'sse', detail?: Record<string, unknown>): void {
    if (event === 'open') { this.websocketActive += 1; this.websocketTotal += 1 }
    if (event === 'close') this.websocketActive = Math.max(0, this.websocketActive - 1)
    const row: RuntimeDiagnosticEvent = { atIso: new Date().toISOString(), kind: `websocket.${event}`, detail }
    this.websocketLastEvent = row
    this.record(row.kind, detail)
  }
  snapshot(): RuntimeDiagnosticsSnapshot {
    return {
      appServer: { ...this.state }, stderrTail: redactDiagnosticText(this.stderrTail, DIAGNOSTICS_MAX_STDERR),
      recentEvents: this.events.slice(0, DIAGNOSTICS_MAX_EVENTS),
      websocket: { activeSubscribers: this.websocketActive, totalConnections: this.websocketTotal, lastEvent: this.websocketLastEvent },
      log: { enabled: true, currentBytes: this.currentBytes, backupCount: this.backupCount, maxBytes: DIAGNOSTICS_MAX_LOG_BYTES },
    }
  }
}

export const runtimeDiagnostics = new RuntimeDiagnostics()
