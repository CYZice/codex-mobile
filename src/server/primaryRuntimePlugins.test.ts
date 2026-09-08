import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ensurePrimaryRuntimePluginsInstalled, PRIMARY_RUNTIME_PLUGIN_NAMES } from './primaryRuntimePlugins.js'

async function createRuntime(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'codex-primary-runtime-plugins-'))
  const root = join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime')
  const dependencies = join(root, 'dependencies')
  await mkdir(join(dependencies, 'node', 'bin'), { recursive: true })
  await mkdir(join(dependencies, 'node', 'node_modules', '@oai', 'artifact-tool'), { recursive: true })
  await mkdir(join(dependencies, 'python', 'Lib', 'site-packages'), { recursive: true })
  await mkdir(join(dependencies, 'bin', 'override'), { recursive: true })
  await mkdir(join(dependencies, 'bin', 'fallback'), { recursive: true })
  await writeFile(join(dependencies, 'node', 'bin', 'node.exe'), '')
  await writeFile(join(dependencies, 'python', 'python.exe'), '')
  await writeFile(join(dependencies, 'bin', 'override', 'native-executables.json'), '{}')
  await writeFile(join(dependencies, 'node', 'node_modules', '@oai', 'artifact-tool', 'package.json'), JSON.stringify({ version: '2.8.59' }))
  await writeFile(join(root, 'runtime.json'), JSON.stringify({
    artifactToolVersion: '2.8.59',
    bundleVersion: '26.905.11957',
    targetPlatform: 'win32',
  }))

  const marketplaceRoot = join(root, 'plugins', 'openai-primary-runtime')
  await mkdir(join(marketplaceRoot, '.agents', 'plugins'), { recursive: true })
  await writeFile(join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({
    name: 'openai-primary-runtime',
    plugins: PRIMARY_RUNTIME_PLUGIN_NAMES.map((name) => ({ name })),
  }))
  return home
}

function pluginList(installed: boolean) {
  return {
    marketplaces: [{
      name: 'openai-primary-runtime',
      path: '',
      plugins: PRIMARY_RUNTIME_PLUGIN_NAMES.map((name) => ({
        name,
        installed,
        enabled: installed,
        localVersion: '26.905.11957',
      })),
    }],
  }
}

function skillsList(home: string, enabled: boolean) {
  return {
    data: [{
      skills: PRIMARY_RUNTIME_PLUGIN_NAMES.map((name) => ({
        name: `${name}:${name}`,
        enabled,
        pluginId: `${name}@openai-primary-runtime`,
        path: join(home, '.codex', 'plugins', 'cache', 'openai-primary-runtime', name, '26.905.11957', 'skills', name, 'SKILL.md'),
      })),
    }],
  }
}

describe('ensurePrimaryRuntimePluginsInstalled', () => {
  it('adds the marketplace, installs missing plugins, and verifies native skills', async () => {
    const home = await createRuntime()
    const calls: Array<{ method: string; params: unknown }> = []
    let skillsReads = 0
    const appServer = {
      rpc: async (method: string, params: unknown) => {
        calls.push({ method, params })
        if (method === 'marketplace/add') return { marketplaceName: 'openai-primary-runtime', alreadyAdded: false }
        if (method === 'plugin/list') {
          const result = pluginList(false)
          result.marketplaces[0].path = join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'plugins', 'openai-primary-runtime', '.agents', 'plugins', 'marketplace.json')
          return result
        }
        if (method === 'plugin/install') return { authPolicy: 'ON_USE', appsNeedingAuth: [] }
        if (method === 'skills/list') {
          skillsReads += 1
          return skillsReads === 1 ? { data: [] } : skillsList(home, true)
        }
        throw new Error(`unexpected ${method}`)
      },
    }

    const result = await ensurePrimaryRuntimePluginsInstalled(appServer, {
      homeDir: home,
      platform: 'win32',
      environment: {},
      createAttemptId: (name) => `test-${name}`,
    })

    expect(result.installed).toEqual(PRIMARY_RUNTIME_PLUGIN_NAMES)
    expect(calls.filter((call) => call.method === 'plugin/install')).toHaveLength(PRIMARY_RUNTIME_PLUGIN_NAMES.length)
    expect(result.skills).toHaveLength(PRIMARY_RUNTIME_PLUGIN_NAMES.length)
  })

  it('is idempotent when the current runtime version is already loaded', async () => {
    const home = await createRuntime()
    const calls: Array<{ method: string; params: unknown }> = []
    const appServer = {
      rpc: async (method: string, params: unknown) => {
        calls.push({ method, params })
        if (method === 'marketplace/add') return { marketplaceName: 'openai-primary-runtime', alreadyAdded: true }
        if (method === 'plugin/list') {
          const result = pluginList(true)
          result.marketplaces[0].path = join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'plugins', 'openai-primary-runtime', '.agents', 'plugins', 'marketplace.json')
          return result
        }
        if (method === 'skills/list') return skillsList(home, true)
        throw new Error(`unexpected ${method}`)
      },
    }

    const result = await ensurePrimaryRuntimePluginsInstalled(appServer, {
      homeDir: home,
      platform: 'win32',
      environment: {},
    })

    expect(result.installed).toEqual([])
    expect(result.alreadyReady).toEqual(PRIMARY_RUNTIME_PLUGIN_NAMES)
    expect(calls.some((call) => call.method === 'plugin/install')).toBe(false)
  })

  it('reinstalls plugins whose loaded skill still points at an older runtime version', async () => {
    const home = await createRuntime()
    const calls: Array<{ method: string; params: unknown }> = []
    let skillsReads = 0
    const staleSkills = skillsList(home, true)
    for (const skill of staleSkills.data[0].skills) {
      skill.path = skill.path.replace('26.905.11957', '26.904.10000')
    }
    const appServer = {
      rpc: async (method: string, params: unknown) => {
        calls.push({ method, params })
        if (method === 'marketplace/add') return { marketplaceName: 'openai-primary-runtime', alreadyAdded: true }
        if (method === 'plugin/list') {
          const result = pluginList(true)
          result.marketplaces[0].path = join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'plugins', 'openai-primary-runtime', '.agents', 'plugins', 'marketplace.json')
          return result
        }
        if (method === 'plugin/install') return { authPolicy: 'ON_USE', appsNeedingAuth: [] }
        if (method === 'skills/list') {
          skillsReads += 1
          return skillsReads === 1 ? staleSkills : skillsList(home, true)
        }
        throw new Error(`unexpected ${method}`)
      },
    }

    const result = await ensurePrimaryRuntimePluginsInstalled(appServer, {
      homeDir: home,
      platform: 'win32',
      environment: {},
      createAttemptId: (name) => `upgrade-${name}`,
    })

    expect(result.installed).toEqual(PRIMARY_RUNTIME_PLUGIN_NAMES)
    expect(calls.filter((call) => call.method === 'plugin/install')).toHaveLength(PRIMARY_RUNTIME_PLUGIN_NAMES.length)
  })
})
