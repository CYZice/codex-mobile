export type ComposerCommand =
  | { name: 'plan'; argument: string }
  | { name: 'review'; target?: ReviewCommandTarget }
  | { name: 'compact' | 'fork' | 'status' | 'fast' }
  | { name: 'memories'; setting?: 'use' | 'generate'; value?: boolean }
  | { name: 'goal'; argument: string }

export type ComposerCommandName = ComposerCommand['name']
export type ReviewCommandTarget =
  | { type: 'uncommittedChanges' }
  | { type: 'baseBranch'; branch: string }
  | { type: 'commit'; sha: string }

export function parseComposerCommand(value: string): ComposerCommand | null {
  const trimmed = value.trim()
  const tokenMatch = trimmed.match(/^\/(plan|review|compact|fork|status|fast|goal|memories)(?:\s+([\s\S]*))?$/i)
  if (!tokenMatch) return null

  const name = tokenMatch[1]?.toLowerCase()
  const argument = tokenMatch[2]?.trim() ?? ''
  if (name === 'memories') {
    if (!argument) return { name }
    const match = argument.match(/^(use|generate)\s+(on|off)$/iu)
    if (!match) return null
    return { name, setting: match[1].toLowerCase() as 'use' | 'generate', value: match[2].toLowerCase() === 'on' }
  }
  if (name === 'plan' || name === 'goal') return { name, argument }
  if (name === 'review') {
    if (!argument) return { name }
    if (/^(?:uncommitted|changes|working-tree)$/iu.test(argument)) {
      return { name, target: { type: 'uncommittedChanges' } }
    }
    const branch = argument.match(/^(?:branch|base)\s+(.+)$/iu)?.[1]?.trim()
    if (branch) return { name, target: { type: 'baseBranch', branch } }
    const sha = argument.match(/^commit\s+([a-f0-9]{7,64})$/iu)?.[1]
    if (sha) return { name, target: { type: 'commit', sha } }
    return { name } // Offer the scope picker rather than sending unknown /review text to a model.
  }
  if (argument) return null
  if (name === 'compact' || name === 'fork' || name === 'status' || name === 'fast') {
    return { name }
  }
  return null
}

export function getComposerCommandQuery(value: string): string | null {
  const match = value.match(/^\/([^\s/]*)$/)
  return match ? (match[1] ?? '').toLowerCase() : null
}
