import { describe, expect, it } from 'vitest'

import {
  buildChatGptConversationReferenceBlock,
  composerReferenceFromHref,
  composerReferenceHref,
  serializeComposerReference,
} from './composerReferences'

describe('composer references', () => {
  it('serializes and restores Desktop-compatible inline reference links', () => {
    const href = composerReferenceHref('chatgpt-conversation', 'chat/id with spaces')
    expect(href).toBe('chatgpt-conversation://chat%2Fid%20with%20spaces')
    expect(serializeComposerReference({ label: 'Reference ] title', href }))
      .toBe(String.raw`[Reference \] title](chatgpt-conversation://chat%2Fid%20with%20spaces)`)
    expect(composerReferenceFromHref('Reference title', href)).toEqual({
      kind: 'chatgpt-conversation',
      id: 'chat/id with spaces',
      label: 'Reference title',
      href,
    })
  })

  it('builds the bounded untrusted reference block used by Desktop submission', () => {
    const block = buildChatGptConversationReferenceBlock({
      conversationId: 'conversation-id',
      title: 'Conversation title',
      preview: { conversation: [], diff: null },
    })

    expect(block).toContain('## Referenced ChatGPT conversation:')
    expect(block).toContain('call `read_thread` with `threadId` set to `conversationId` and `turnLimit` set to 10')
    expect(block).toContain('\"conversationId\":\"conversation-id\"')
    expect(block).toContain('\"priorConversation\":{\"conversation\":[],\"diff\":null}')
  })
})
