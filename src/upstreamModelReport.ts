import type { RpcNotification } from './api/codexRpcClient'

/** Model claimed by a Responses SSE event, not the requested or selected model. */
export type UpstreamModelReport = {
  threadId: string
  turnId: string
  model: string
  responseId: string
  phase: 'created' | 'completed'
  responseCount: number
}

export function readUpstreamModelReport(notification: RpcNotification): Omit<UpstreamModelReport, 'responseCount'> | null {
  if (notification.method !== 'codexMobile/upstreamModelReported') return null
  const params = notification.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null
  const data = params as Record<string, unknown>
  const { threadId, turnId, model, responseId, phase } = data
  if (typeof threadId !== 'string' || !threadId.trim()
    || typeof turnId !== 'string' || !turnId.trim()
    || typeof model !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/u.test(model)
    || typeof responseId !== 'string' || !/^[a-zA-Z0-9_-]{0,128}$/u.test(responseId)
    || (phase !== 'created' && phase !== 'completed')) return null
  return { threadId: threadId.trim(), turnId: turnId.trim(), model, responseId, phase }
}
