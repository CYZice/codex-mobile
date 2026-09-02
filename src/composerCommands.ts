export type ComposerCommand =
  | { name: 'plan'; argument: string }
  | { name: 'review' }

export function parseComposerCommand(value: string): ComposerCommand | null {
  const trimmed = value.trim()
  const tokenMatch = trimmed.match(/^\/(plan|review)(?:\s+([\s\S]*))?$/i)
  if (!tokenMatch) return null

  const name = tokenMatch[1]?.toLowerCase()
  const argument = tokenMatch[2]?.trim() ?? ''
  if (name === 'review') {
    return argument ? null : { name: 'review' }
  }
  return { name: 'plan', argument }
}

export function getComposerCommandQuery(value: string): string | null {
  const match = value.match(/^\/([^\s/]*)$/)
  return match ? (match[1] ?? '').toLowerCase() : null
}
