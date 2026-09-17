import type { RpcNotification } from './api/codexRpcClient'

export type ModelReroute = {
  threadId: string
  turnId: string
  fromModel: string
  toModel: string
}

// Only an explicit Codex app-server reroute is evidence of an upstream model.
// The selected model and rollout turn_context.model are not upstream reports.
export function readModelReroute(notification: RpcNotification): ModelReroute | null {
  if (notification.method !== 'model/rerouted') return null
  const params = notification.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null
  const record = params as Record<string, unknown>
  const { threadId, turnId, fromModel, toModel } = record
  if (
    typeof threadId !== 'string' || !threadId.trim()
    || typeof turnId !== 'string' || !turnId.trim()
    || typeof fromModel !== 'string' || !fromModel.trim()
    || typeof toModel !== 'string' || !toModel.trim()
  ) return null
  return {
    threadId: threadId.trim(),
    turnId: turnId.trim(),
    fromModel: fromModel.trim(),
    toModel: toModel.trim(),
  }
}
