import type { UiMessage } from '../../types/codex'

export type WorkedTurnActivityGroup = {
  activityMessageIds: string[]
  hasFinalAssistantMessage: boolean
}

function isFinalAssistantMessage(message: UiMessage | undefined): boolean {
  return message?.role === 'assistant'
    && message.messageType !== 'agentMessage.live'
    && message.messageType !== 'plan.live'
}

export function groupWorkedTurnActivity(messages: UiMessage[]): Record<string, WorkedTurnActivityGroup> {
  const groups: Record<string, WorkedTurnActivityGroup> = {}

  for (let workedIndex = 0; workedIndex < messages.length; workedIndex += 1) {
    const workedMessage = messages[workedIndex]
    if (workedMessage.messageType !== 'worked') continue

    let startIndex = workedIndex
    while (startIndex > 0) {
      const previous = messages[startIndex - 1]
      if (previous.role === 'user' || previous.messageType === 'worked') break
      startIndex -= 1
    }

    groups[workedMessage.id] = {
      activityMessageIds: messages.slice(startIndex, workedIndex).map((message) => message.id),
      hasFinalAssistantMessage: isFinalAssistantMessage(messages[workedIndex + 1]),
    }
  }

  return groups
}
