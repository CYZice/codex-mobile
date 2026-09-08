import { describe, expect, it } from 'vitest'

import { extractChatgptPreview, paginateChatgptConversationRows } from './codexAppServerBridge'

function node(parent: string | null, role: 'user' | 'assistant', text: string, status?: string) {
  return {
    parent,
    message: {
      author: { role },
      content: { parts: [text] },
      ...(status ? { status } : {}),
    },
  }
}

describe('extractChatgptPreview', () => {
  it('keeps the current branch and returns at most the latest three user turns', () => {
    const preview = extractChatgptPreview({
      current_node: 'a4',
      mapping: {
        u1: node(null, 'user', 'old user'),
        a1: node('u1', 'assistant', 'old assistant', 'finished_successfully'),
        u2: node('a1', 'user', 'second user'),
        a2: node('u2', 'assistant', 'second assistant', 'finished_successfully'),
        u3: node('a2', 'user', 'third user'),
        a3: node('u3', 'assistant', 'third assistant', 'finished_successfully'),
        u4: node('a3', 'user', 'latest user'),
        a4: node('u4', 'assistant', 'latest assistant', 'finished_successfully'),
        branch: node('u2', 'assistant', 'unselected branch', 'finished_successfully'),
      },
    })

    expect(preview).toEqual({
      conversation: [
        { role: 'user', content: [{ content_type: 'text', text: 'second user' }] },
        { role: 'assistant', content: [{ content_type: 'text', text: 'second assistant' }] },
        { role: 'user', content: [{ content_type: 'text', text: 'third user' }] },
        { role: 'assistant', content: [{ content_type: 'text', text: 'third assistant' }] },
        { role: 'user', content: [{ content_type: 'text', text: 'latest user' }] },
        { role: 'assistant', content: [{ content_type: 'text', text: 'latest assistant' }] },
      ],
      diff: null,
    })
  })

  it('drops incomplete assistant messages and bounds each text item', () => {
    const preview = extractChatgptPreview({
      current_node: 'a2',
      mapping: {
        u1: node(null, 'user', 'x'.repeat(2500)),
        a1: node('u1', 'assistant', 'unfinished', 'in_progress'),
        a2: node('a1', 'assistant', 'complete', 'finished_successfully'),
      },
    })

    expect(preview?.conversation).toHaveLength(2)
    expect(preview?.conversation[0]?.content[0]?.text).toHaveLength(2000)
    expect(preview?.conversation[1]?.content[0]?.text).toBe('complete')
  })

  it('pages older messages with an opaque cursor and caps the page size at ten', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      nodeId: 'node-' + index,
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      text: 'message-' + index,
    }))

    const latest = paginateChatgptConversationRows(rows, 50, null)
    expect(latest.messages).toHaveLength(10)
    expect(latest.messages[0]?.content[0]?.text).toBe('message-2')
    expect(latest.messages.at(-1)?.content[0]?.text).toBe('message-11')
    expect(latest.nextCursor).toBeTruthy()

    const older = paginateChatgptConversationRows(rows, 10, latest.nextCursor)
    expect(older.messages.map((item) => item.content[0]?.text)).toEqual(['message-0', 'message-1'])
    expect(older.nextCursor).toBeNull()
  })

  it('rejects a cursor from a changed branch instead of returning misleading history', () => {
    const rows = [{ nodeId: 'node-1', role: 'user' as const, text: 'message-1' }]
    expect(() => paginateChatgptConversationRows(rows, 10, 'eyJub2RlSWQiOiJtaXNzaW5nIn0')).toThrow(/conversation changed/i)
  })
})
