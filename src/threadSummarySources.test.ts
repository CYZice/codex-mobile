import { describe, expect, it } from 'vitest'
import { buildThreadSummarySources, toThreadSummaryBrowseUrl } from './threadSummarySources'
import type { UiMessage } from './types/codex'

describe('thread summary sources', () => {
  it('builds clickable file, image, link, and skill sources', () => {
    const messages: UiMessage[] = [{
      id: 'message-1',
      role: 'user',
      text: 'See [project](https://github.com/example/project), [plan](docs/plan.md), and https://example.com/docs.',
      fileAttachments: [{ label: 'notes.txt', path: 'notes.txt' }],
      images: ['D:/workspace/image.png'],
      skills: [{ name: 'Review skill', path: 'D:/skills/review/SKILL.md' }],
    }]

    expect(buildThreadSummarySources(messages, 'D:/workspace')).toEqual([
      expect.objectContaining({ kind: 'file', label: 'notes.txt', href: '/codex-local-browse/D:/workspace/notes.txt' }),
      expect.objectContaining({ kind: 'image', label: 'image.png', href: '/codex-local-image?path=D%3A%2Fworkspace%2Fimage.png' }),
      expect.objectContaining({ kind: 'link', label: 'project', href: 'https://github.com/example/project' }),
      expect.objectContaining({ kind: 'file', label: 'plan', href: '/codex-local-browse/D:/workspace/docs/plan.md' }),
      expect.objectContaining({ kind: 'link', label: 'example.com/docs', href: 'https://example.com/docs' }),
      expect.objectContaining({ kind: 'skill', label: 'Review skill', href: '/codex-local-browse/D:/skills/review/SKILL.md' }),
    ])
  })

  it('resolves relative paths against the thread cwd', () => {
    expect(toThreadSummaryBrowseUrl('docs/plan.md', 'D:\\repo')).toBe('/codex-local-browse/D:%5Crepo%5Cdocs/plan.md')
  })
})
