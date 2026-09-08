import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { homedir } from 'node:os'

import { resolveWorkspaceDependencyRuntime } from './workspaceDependencies.js'

export const PRIMARY_RUNTIME_MARKETPLACE_NAME = 'openai-primary-runtime'
export const PRIMARY_RUNTIME_PLUGIN_NAMES = [
  'documents',
  'pdf',
  'spreadsheets',
  'presentations',
  'template-creator',
] as const

type JsonRecord = Record<string, unknown>

export type PrimaryRuntimeRpc = {
  rpc: (method: string, params: unknown) => Promise<unknown>
}

export type PrimaryRuntimePluginSyncResult = {
  marketplaceRoot: string
  marketplacePath: string
  installed: string[]
  alreadyReady: string[]
  skills: string[]
}

type PrimaryRuntimePluginSyncOptions = {
  environment?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  homeDir?: string
  createAttemptId?: (pluginName: string) => string
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeForComparison(path: string): string {
  return normalize(path).toLowerCase()
}

function skillPathUsesVersion(path: string, version: string): boolean {
  if (!path || !version) return false
  const needle = `${sep}${version}${sep}`.toLowerCase()
  return normalizeForComparison(path).includes(needle)
}

function collectSkillsByPluginId(payload: unknown): Map<string, Array<{ name: string; path: string; enabled: boolean }>> {
  const result = new Map<string, Array<{ name: string; path: string; enabled: boolean }>>()
  const root = asRecord(payload)
  const data = Array.isArray(root?.data) ? root.data : []
  for (const rawEntry of data) {
    const entry = asRecord(rawEntry)
    const skills = Array.isArray(entry?.skills) ? entry.skills : []
    for (const rawSkill of skills) {
      const skill = asRecord(rawSkill)
      const pluginId = readString(skill?.pluginId)
      if (!pluginId) continue
      const rows = result.get(pluginId) ?? []
      rows.push({
        name: readString(skill?.name),
        path: readString(skill?.path),
        enabled: skill?.enabled !== false,
      })
      result.set(pluginId, rows)
    }
  }
  return result
}

function readPrimaryMarketplace(payload: unknown): JsonRecord | null {
  const root = asRecord(payload)
  const marketplaces = Array.isArray(root?.marketplaces) ? root.marketplaces : []
  for (const rawMarketplace of marketplaces) {
    const marketplace = asRecord(rawMarketplace)
    if (readString(marketplace?.name) === PRIMARY_RUNTIME_MARKETPLACE_NAME) return marketplace
  }
  return null
}

async function validateMarketplaceRoot(marketplaceRoot: string): Promise<string> {
  const marketplacePath = join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json')
  if (!await isFile(marketplacePath)) {
    throw new Error(`Primary runtime marketplace manifest is missing: ${marketplacePath}`)
  }
  const manifest = asRecord(JSON.parse(await readFile(marketplacePath, 'utf8')))
  if (!manifest || readString(manifest.name) !== PRIMARY_RUNTIME_MARKETPLACE_NAME) {
    throw new Error(`Primary runtime marketplace has an unexpected name: ${marketplacePath}`)
  }
  const plugins = Array.isArray(manifest.plugins) ? manifest.plugins : []
  const names = new Set(plugins.map((value) => readString(asRecord(value)?.name)).filter(Boolean))
  const missing = PRIMARY_RUNTIME_PLUGIN_NAMES.filter((name) => !names.has(name))
  if (missing.length > 0) {
    throw new Error(`Primary runtime marketplace is missing plugins: ${missing.join(', ')}`)
  }
  return marketplacePath
}

export async function ensurePrimaryRuntimePluginsInstalled(
  appServer: PrimaryRuntimeRpc,
  options: PrimaryRuntimePluginSyncOptions = {},
): Promise<PrimaryRuntimePluginSyncResult> {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? homedir()
  const runtime = await resolveWorkspaceDependencyRuntime(environment, platform, homeDir)
  const marketplaceRoot = join(runtime.runtimeRoot, 'plugins', PRIMARY_RUNTIME_MARKETPLACE_NAME)
  const marketplacePath = await validateMarketplaceRoot(marketplaceRoot)

  await appServer.rpc('marketplace/add', { source: marketplaceRoot })

  const pluginList = await appServer.rpc('plugin/list', { marketplaceKinds: ['local'] })
  const marketplace = readPrimaryMarketplace(pluginList)
  if (!marketplace) {
    throw new Error('Primary runtime marketplace was added but plugin/list did not return it')
  }
  const listedMarketplacePath = readString(marketplace.path)
  if (listedMarketplacePath && normalizeForComparison(listedMarketplacePath) !== normalizeForComparison(marketplacePath)) {
    throw new Error(`Primary runtime marketplace path mismatch: ${listedMarketplacePath}`)
  }

  const listedPlugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : []
  const pluginsByName = new Map<string, JsonRecord>()
  for (const rawPlugin of listedPlugins) {
    const plugin = asRecord(rawPlugin)
    const name = readString(plugin?.name)
    if (name) pluginsByName.set(name, plugin ?? {})
  }

  const initialSkills = collectSkillsByPluginId(await appServer.rpc('skills/list', { forceReload: true }))
  const toInstall: string[] = []
  const alreadyReady: string[] = []

  for (const name of PRIMARY_RUNTIME_PLUGIN_NAMES) {
    const plugin = pluginsByName.get(name)
    if (!plugin) throw new Error(`Primary runtime plugin is missing from plugin/list: ${name}`)
    const pluginId = `${name}@${PRIMARY_RUNTIME_MARKETPLACE_NAME}`
    const localVersion = readString(plugin.localVersion) || runtime.bundleVersion
    const skills = initialSkills.get(pluginId) ?? []
    const skillsReady = skills.length > 0
      && skills.every((skill) => skill.enabled && skillPathUsesVersion(skill.path, localVersion))
    if (plugin.installed === true && plugin.enabled === true && skillsReady) {
      alreadyReady.push(name)
    } else {
      toInstall.push(name)
    }
  }

  for (const name of toInstall) {
    await appServer.rpc('plugin/install', {
      marketplacePath,
      pluginName: name,
      installAttemptId: options.createAttemptId?.(name) ?? `codex-mobile-primary-runtime-${name}-${randomUUID()}`,
    })
  }

  const finalSkillsPayload = await appServer.rpc('skills/list', { forceReload: true })
  const finalSkills = collectSkillsByPluginId(finalSkillsPayload)
  const surfacedSkills: string[] = []
  const missing: string[] = []

  for (const name of PRIMARY_RUNTIME_PLUGIN_NAMES) {
    const plugin = pluginsByName.get(name)
    const pluginId = `${name}@${PRIMARY_RUNTIME_MARKETPLACE_NAME}`
    const localVersion = readString(plugin?.localVersion) || runtime.bundleVersion
    const skills = finalSkills.get(pluginId) ?? []
    const ready = skills.length > 0
      && skills.every((skill) => skill.enabled && skillPathUsesVersion(skill.path, localVersion))
    if (!ready) {
      missing.push(name)
      continue
    }
    surfacedSkills.push(...skills.map((skill) => skill.name).filter(Boolean))
  }

  if (missing.length > 0) {
    throw new Error(`Primary runtime plugins were installed but skills are still unavailable: ${missing.join(', ')}`)
  }

  return {
    marketplaceRoot,
    marketplacePath,
    installed: toInstall,
    alreadyReady,
    skills: surfacedSkills,
  }
}
