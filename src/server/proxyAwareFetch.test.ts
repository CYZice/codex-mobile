import { describe, expect, it } from 'vitest'

import { parseWindowsProxyServer, resolveProxyUrl } from './proxyAwareFetch'

describe('proxy-aware fetch configuration', () => {
  it('prefers HTTPS proxy environment variables and honors NO_PROXY', () => {
    const environment = {
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      HTTP_PROXY: 'http://127.0.0.1:8080',
      NO_PROXY: 'localhost,.openai.com',
    }

    expect(resolveProxyUrl('https://chatgpt.com/backend-api/conversations', environment)).toBe('http://127.0.0.1:7897')
    expect(resolveProxyUrl('https://api.openai.com/v1/models', environment)).toBe('')
  })

  it('uses the Windows proxy when the process has no proxy environment', () => {
    expect(resolveProxyUrl(
      'https://chatgpt.com/backend-api/conversations',
      {},
      '127.0.0.1:7897',
    )).toBe('http://127.0.0.1:7897')
  })

  it('selects the protocol-specific Windows proxy entry', () => {
    const raw = 'http=127.0.0.1:8080;https=127.0.0.1:7897;socks=127.0.0.1:1080'
    expect(parseWindowsProxyServer(raw, 'https:')).toBe('http://127.0.0.1:7897')
    expect(parseWindowsProxyServer(raw, 'http:')).toBe('http://127.0.0.1:8080')
  })

  it('matches default ports in NO_PROXY entries', () => {
    const environment = {
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      NO_PROXY: 'chatgpt.com:443',
    }

    expect(resolveProxyUrl('https://chatgpt.com/backend-api/conversations', environment)).toBe('')
  })
})
