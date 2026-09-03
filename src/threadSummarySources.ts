import type { UiMessage } from './types/codex'
import { getPathLeafName, isAbsoluteLikePath, normalizePathForUi } from './pathUtils'

export type ThreadSummarySourceKind = 'file' | 'image' | 'link' | 'skill'

export type ThreadSummarySource = {
  id: string
  kind: ThreadSummarySourceKind
  label: string
  href: string
  title: string
}

function joinPath(base: string, value: string): string {
  const normalizedBase = normalizePathForUi(base).replace(/[\\/]+$/u, '')
  const normalizedValue = normalizePathForUi(value).replace(/^[\\/]+/u, '')
  if (!normalizedBase) return normalizedValue
  const separator = normalizedBase.includes('\\') && !normalizedBase.includes('/') ? '\\' : '/'
  return `${normalizedBase}${separator}${normalizedValue}`
}

export function toThreadSummaryBrowseUrl(pathValue: string, cwd: string): string {
  const normalized = normalizePathForUi(pathValue).trim()
  if (!normalized) return ''
  const resolved = isAbsoluteLikePath(normalized) ? normalized : joinPath(cwd, normalized)
  if (!isAbsoluteLikePath(resolved)) return ''
  const absolute = resolved.startsWith('/') ? resolved : `/${resolved}`
  return `/codex-local-browse${encodeURI(absolute)}`
}

function imageHref(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  if (/^(?:data:|blob:|https?:\/\/|\/codex-local-image\?)/iu.test(normalized)) return normalized
  if (normalized.startsWith('file://') || isAbsoluteLikePath(normalized)) {
    return `/codex-local-image?path=${encodeURIComponent(normalized)}`
  }
  return normalized
}

function imageLabel(value: string, index: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('blob:')) return `图片 ${index + 1}`
  try {
    const parsed = new URL(normalized, 'http://codex.local')
    const fromQuery = parsed.searchParams.get('path')
    const leaf = getPathLeafName(fromQuery ? decodeURIComponent(fromQuery) : parsed.pathname)
    return leaf || `图片 ${index + 1}`
  } catch {
    return getPathLeafName(normalized) || `图片 ${index + 1}`
  }
}

function trimUrlPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/u, '')
}

function isLocalReference(value: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) return false
  const pathWithoutQuery = value.split(/[?#]/u, 1)[0] ?? value
  return isAbsoluteLikePath(pathWithoutQuery) || /(?:[\\/]|\.[a-z0-9]{1,12})$/iu.test(pathWithoutQuery)
}

type MessageReference = { label: string; href: string; kind: 'file' | 'link' }

function messageReferences(text: string, cwd: string): MessageReference[] {
  const references: MessageReference[] = []
  const markdownTargets = new Set<string>()
  const markdownPattern = /\[([^\]]+)\]\(([^\s)]+)\)/gu
  for (const match of text.matchAll(markdownPattern)) {
    const href = trimUrlPunctuation(match[2] ?? '')
    if (!href) continue
    markdownTargets.add(href)
    if (/^https?:\/\//iu.test(href)) {
      references.push({ label: (match[1] ?? '').trim() || href, href, kind: 'link' })
      continue
    }
    if (isLocalReference(href)) {
      const localHref = toThreadSummaryBrowseUrl(href, cwd)
      if (localHref) references.push({ label: (match[1] ?? '').trim() || getPathLeafName(href) || href, href: localHref, kind: 'file' })
    } else {
      references.push({ label: (match[1] ?? '').trim() || href, href, kind: 'link' })
    }
  }
  const plainPattern = /https?:\/\/[^\s<>()]+/giu
  for (const match of text.matchAll(plainPattern)) {
    const href = trimUrlPunctuation(match[0] ?? '')
    if (!href || markdownTargets.has(href)) continue
    let label = href
    try {
      const parsed = new URL(href)
      label = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
    } catch {
      // Keep the original URL as its label.
    }
    references.push({ label, href, kind: 'link' })
  }
  return references
}

export function buildThreadSummarySources(messages: readonly UiMessage[], cwd: string, limit = 8): ThreadSummarySource[] {
  const sources: ThreadSummarySource[] = []
  const seen = new Set<string>()
  const push = (source: Omit<ThreadSummarySource, 'id'>): void => {
    const key = `${source.kind}:${source.href}`
    if (!source.href || seen.has(key) || sources.length >= limit) return
    seen.add(key)
    sources.push({ ...source, id: key })
  }

  for (let messageIndex = messages.length - 1; messageIndex >= 0 && sources.length < limit; messageIndex -= 1) {
    const message = messages[messageIndex]
    for (const attachment of message.fileAttachments ?? []) {
      const href = toThreadSummaryBrowseUrl(attachment.path, cwd)
      push({ kind: 'file', label: attachment.label?.trim() || getPathLeafName(attachment.path) || attachment.path, href, title: attachment.path })
    }
    for (let imageIndex = 0; imageIndex < (message.images?.length ?? 0); imageIndex += 1) {
      const value = message.images?.[imageIndex] ?? ''
      const href = imageHref(value)
      push({ kind: 'image', label: imageLabel(value, imageIndex), href, title: value })
    }
    for (const reference of messageReferences(message.text, cwd)) {
      push({ kind: reference.kind, label: reference.label, href: reference.href, title: reference.href })
    }
    for (const skill of message.skills ?? []) {
      const href = toThreadSummaryBrowseUrl(skill.path, cwd)
      push({ kind: 'skill', label: skill.name?.trim() || getPathLeafName(skill.path) || skill.path, href, title: skill.path })
    }
  }

  return sources
}
