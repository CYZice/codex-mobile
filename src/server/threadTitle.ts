export const THREAD_TITLE_MAX_CHARS = 36
export const THREAD_TITLE_PROMPT_MAX_BYTES = 960
export const THREAD_TITLE_MODEL = 'gpt-5.6-luna'

const TITLE_INSTRUCTIONS =
  `Generate a concise, single-line task title of at most ${THREAD_TITLE_MAX_CHARS} characters and under five words where possible. `
  + 'Start with an imperative verb. Capitalize only the first word unless the user\'s language, proper nouns, acronyms, or code terms require otherwise. '
  + 'Preserve ticket references exactly. Write in the user\'s language. Do not use quotes, markdown, or trailing punctuation. Do not answer the request.'

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0
  let result = ''
  for (const character of value) {
    const nextBytes = Buffer.byteLength(character, 'utf8')
    if (bytes + nextBytes > maxBytes) break
    result += character
    bytes += nextBytes
  }
  return result
}

export function buildAutomaticThreadTitlePrompt(userMessage: string): string {
  const prefix = `${TITLE_INSTRUCTIONS}\n\nUser prompt:\n`
  const remaining = Math.max(0, THREAD_TITLE_PROMPT_MAX_BYTES - Buffer.byteLength(prefix, 'utf8'))
  return `${prefix}${truncateUtf8(userMessage.trim(), remaining)}`
}

export function threadTitleOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: THREAD_TITLE_MAX_CHARS,
      },
    },
    required: ['title'],
    additionalProperties: false,
  }
}

export function parseStructuredThreadTitle(response: string): string | null {
  const trimmed = response.trimStart()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const keys = Object.keys(parsed as Record<string, unknown>)
    if (keys.length !== 1 || keys[0] !== 'title') return null
    const rawTitle = (parsed as Record<string, unknown>).title
    if (typeof rawTitle !== 'string') return null
    const normalized = rawTitle
      .trim()
      .replace(/^["'`“”‘’]+|["'`“”‘’]+$/gu, '')
      .split(/\s+/u)
      .filter(Boolean)
      .join(' ')
      .replace(/[.?!]+$/u, '')
      .trim()
    if (!normalized) return null
    return [...normalized].slice(0, THREAD_TITLE_MAX_CHARS).join('')
  } catch {
    return null
  }
}

export function isAutomaticThreadTitleEligible(thread: unknown): boolean {
  if (!thread || typeof thread !== 'object' || Array.isArray(thread)) return false
  const record = thread as Record<string, unknown>
  if (record.ephemeral === true) return false
  if (typeof record.name === 'string' && record.name.trim()) return false
  const threadSource = typeof record.threadSource === 'string' ? record.threadSource.trim() : ''
  return !threadSource || threadSource === 'user'
}

export function shouldApplyAutomaticThreadTitle(currentName: unknown, cancelled: boolean): boolean {
  if (cancelled) return false
  return !(typeof currentName === 'string' && currentName.trim())
}

export function readCompletedUserMessageForTitle(notification: { method: string; params: unknown }): { threadId: string; prompt: string } | null {
  if (notification.method !== 'item/completed') return null
  if (!notification.params || typeof notification.params !== 'object' || Array.isArray(notification.params)) return null
  const params = notification.params as Record<string, unknown>
  const threadId = typeof params.threadId === 'string'
    ? params.threadId.trim()
    : typeof params.thread_id === 'string'
      ? params.thread_id.trim()
      : ''
  const item = params.item
  if (!threadId || !item || typeof item !== 'object' || Array.isArray(item)) return null
  const itemRecord = item as Record<string, unknown>
  if (itemRecord.type !== 'userMessage' || !Array.isArray(itemRecord.content)) return null
  const prompt = itemRecord.content
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ''
      const record = entry as Record<string, unknown>
      return typeof record.text === 'string' ? record.text.trim() : ''
    })
    .filter(Boolean)
    .join(' ')
    .trim()
  return prompt ? { threadId, prompt } : null
}
