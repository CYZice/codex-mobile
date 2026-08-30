import type { UiThread } from '../../types/codex'

export type ActivityDateGroup = {
  key: string
  label: string
  threads: UiThread[]
}

export function isAttentionThread(thread: UiThread): boolean {
  return Boolean(thread.pendingRequestState || thread.inProgress || thread.unread)
}

export function getThreadActivityTimestamp(thread: UiThread): number {
  const updatedAt = Date.parse(thread.updatedAtIso || '')
  if (Number.isFinite(updatedAt)) return updatedAt
  const createdAt = Date.parse(thread.createdAtIso || '')
  return Number.isFinite(createdAt) ? createdAt : 0
}

export function sortThreadsByActivity(threads: UiThread[]): UiThread[] {
  return [...threads].sort((first, second) => {
    const timestampDelta = getThreadActivityTimestamp(second) - getThreadActivityTimestamp(first)
    return timestampDelta || first.id.localeCompare(second.id)
  })
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function groupThreadsByActivityDate(
  threads: UiThread[],
  options: {
    now?: Date
    locale?: string
    todayLabel?: string
    yesterdayLabel?: string
    earlierLabel?: string
  } = {},
): ActivityDateGroup[] {
  const now = options.now ?? new Date()
  const todayStart = startOfLocalDay(now).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const formatter = new Intl.DateTimeFormat(options.locale, { month: 'short', day: 'numeric', year: 'numeric' })
  const weekdayFormatter = new Intl.DateTimeFormat(options.locale, { weekday: 'long' })
  const groups = new Map<string, ActivityDateGroup>()

  for (const thread of sortThreadsByActivity(threads)) {
    const timestamp = getThreadActivityTimestamp(thread)
    let key = 'earlier'
    let label = options.earlierLabel ?? 'Earlier'

    if (timestamp > 0) {
      const date = new Date(timestamp)
      const dateStart = startOfLocalDay(date).getTime()
      const dayDifference = Math.round((todayStart - dateStart) / dayMs)
      if (dayDifference === 0) {
        key = 'today'
        label = options.todayLabel ?? 'Today'
      } else if (dayDifference === 1) {
        key = 'yesterday'
        label = options.yesterdayLabel ?? 'Yesterday'
      } else if (dayDifference >= 2 && dayDifference <= 6) {
        key = `weekday-${dateStart}`
        label = weekdayFormatter.format(date)
      } else {
        key = `date-${dateStart}`
        label = formatter.format(date)
      }
    }

    const group = groups.get(key) ?? { key, label, threads: [] }
    group.threads.push(thread)
    groups.set(key, group)
  }

  return [...groups.values()]
}
