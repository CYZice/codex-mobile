import { spawnSync } from 'node:child_process'
import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici'

const WINDOWS_PROXY_CACHE_MS = 30_000

type ProxyEnvironment = Record<string, string | undefined>

let cachedWindowsProxy: { at: number; server: string } | null = null
const proxyAgents = new Map<string, Dispatcher>()

function readEnvironmentValue(environment: ProxyEnvironment, ...keys: string[]): string {
  for (const key of keys) {
    const value = environment[key]?.trim()
    if (value) return value
  }
  return ''
}

function normalizeProxyUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`
}

export function parseWindowsProxyServer(rawValue: string, targetProtocol: string): string {
  const raw = rawValue.trim()
  if (!raw) return ''
  if (!raw.includes(';') && !/^[a-z]+=/iu.test(raw)) return normalizeProxyUrl(raw)

  const entries = new Map<string, string>()
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    const key = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (key && value) entries.set(key, value)
  }
  const protocolKey = targetProtocol.replace(/:$/u, '').toLowerCase()
  return normalizeProxyUrl(entries.get(protocolKey) ?? entries.get('http') ?? entries.get('https') ?? entries.get('socks') ?? '')
}

function matchesNoProxyEntry(url: URL, entryRaw: string): boolean {
  const entry = entryRaw.trim().toLowerCase()
  if (!entry) return false
  if (entry === '*') return true

  const normalized = entry.includes('://') ? entry.slice(entry.indexOf('://') + 3) : entry
  const withoutPath = normalized.split('/')[0] ?? ''
  const separator = withoutPath.lastIndexOf(':')
  const hasPort = separator > 0 && /^\d+$/u.test(withoutPath.slice(separator + 1))
  const host = (hasPort ? withoutPath.slice(0, separator) : withoutPath).replace(/^\./u, '')
  const port = hasPort ? withoutPath.slice(separator + 1) : ''
  const targetPort = url.port || (url.protocol === 'https:' ? '443' : url.protocol === 'http:' ? '80' : '')
  if (!host || (port && port !== targetPort)) return false
  return url.hostname.toLowerCase() === host || url.hostname.toLowerCase().endsWith(`.${host}`)
}

function shouldBypassProxy(url: URL, environment: ProxyEnvironment): boolean {
  const noProxy = readEnvironmentValue(environment, 'NO_PROXY', 'no_proxy')
  if (!noProxy) return false
  return noProxy.split(',').some((entry) => matchesNoProxyEntry(url, entry))
}

export function resolveProxyUrl(
  target: string | URL,
  environment: ProxyEnvironment = process.env,
  windowsProxyServer = '',
): string {
  const url = target instanceof URL ? target : new URL(target)
  if (shouldBypassProxy(url, environment)) return ''

  const environmentProxy = url.protocol === 'https:'
    ? readEnvironmentValue(environment, 'HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy')
    : readEnvironmentValue(environment, 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy')
  if (environmentProxy) return normalizeProxyUrl(environmentProxy)
  return parseWindowsProxyServer(windowsProxyServer, url.protocol)
}

function readWindowsProxyServer(): string {
  if (process.platform !== 'win32') return ''
  const now = Date.now()
  if (cachedWindowsProxy && now - cachedWindowsProxy.at < WINDOWS_PROXY_CACHE_MS) {
    return cachedWindowsProxy.server
  }

  let server = ''
  try {
    const result = spawnSync('reg.exe', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
    ], { encoding: 'utf8', windowsHide: true, timeout: 2_000 })
    const output = typeof result.stdout === 'string' ? result.stdout : ''
    const enabledMatch = /^\s*ProxyEnable\s+REG_DWORD\s+0x([0-9a-f]+)\s*$/imu.exec(output)
    const serverMatch = /^\s*ProxyServer\s+REG_SZ\s+(.+?)\s*$/imu.exec(output)
    if (enabledMatch && Number.parseInt(enabledMatch[1] ?? '0', 16) !== 0) {
      server = serverMatch?.[1]?.trim() ?? ''
    }
  } catch {
    server = ''
  }

  cachedWindowsProxy = { at: now, server }
  return server
}

function getProxyAgent(proxyUrl: string): Dispatcher {
  const existing = proxyAgents.get(proxyUrl)
  if (existing) return existing
  const agent = new ProxyAgent(proxyUrl)
  proxyAgents.set(proxyUrl, agent)
  return agent
}

export async function proxyAwareFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = input instanceof URL ? input : new URL(input)
  const proxyUrl = resolveProxyUrl(url, process.env, readWindowsProxyServer())
  if (!proxyUrl) return fetch(url, init)

  return undiciFetch(url, {
    ...(init as Record<string, unknown>),
    dispatcher: getProxyAgent(proxyUrl),
  } as never) as unknown as Promise<Response>
}

export function describeProxyRoute(target: string | URL): 'proxy' | 'direct' {
  return resolveProxyUrl(target, process.env, readWindowsProxyServer()) ? 'proxy' : 'direct'
}
