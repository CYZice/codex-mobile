import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  projectCcSwitchCodexConfig,
  readCcSwitchStatus,
  switchCcSwitchProvider,
  watchCcSwitchExternalChanges,
} from './ccSwitch.js'

type FixtureProvider = {
  id: string
  name: string
  category: string
  config: string
  auth: Record<string, unknown>
  modelCatalog?: unknown
  isCurrent?: boolean
}

const cleanupPaths: string[] = []

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function createFixture(options: {
  providers: FixtureProvider[]
  currentProviderId: string
  schemaVersion?: number
  proxyTakeover?: boolean
}) {
  const root = await mkdtemp(join(tmpdir(), 'codex-mobile-cc-switch-'))
  cleanupPaths.push(root)
  const ccSwitchHome = join(root, '.cc-switch')
  const codexHome = join(root, '.codex')
  await mkdir(ccSwitchHome, { recursive: true })
  await mkdir(codexHome, { recursive: true })
  const settingsPath = join(ccSwitchHome, 'settings.json')
  const databasePath = join(ccSwitchHome, 'cc-switch.db')
  const configPath = join(codexHome, 'config.toml')
  const authPath = join(codexHome, 'auth.json')
  const settings = {
    preserveCodexOfficialAuthOnSwitch: true,
    unifyCodexSessionHistory: true,
    currentProviderCodex: options.currentProviderId,
  }
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await writeFile(configPath, '# original config\nmodel = "original"\n', 'utf8')
  await writeFile(authPath, '{"tokens":{"access_token":"official-token"}}\n', 'utf8')

  const db = new DatabaseSync(databasePath)
  db.exec(`
    PRAGMA user_version = ${options.schemaVersion ?? 18};
    CREATE TABLE providers (
      id TEXT NOT NULL,
      app_type TEXT NOT NULL,
      name TEXT NOT NULL,
      settings_config TEXT NOT NULL,
      category TEXT,
      created_at INTEGER,
      sort_index INTEGER,
      is_current BOOLEAN NOT NULL DEFAULT 0,
      PRIMARY KEY (id, app_type)
    );
    CREATE TABLE proxy_config (
      app_type TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      live_takeover_active INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE proxy_live_backup (
      app_type TEXT PRIMARY KEY,
      original_config TEXT NOT NULL,
      backed_up_at TEXT NOT NULL
    );
  `)
  const insertProvider = db.prepare(`
    INSERT INTO providers (id, app_type, name, settings_config, category, created_at, sort_index, is_current)
    VALUES (?, 'codex', ?, ?, ?, ?, ?, ?)
  `)
  options.providers.forEach((provider, index) => {
    insertProvider.run(
      provider.id,
      provider.name,
      JSON.stringify({
        config: provider.config,
        auth: provider.auth,
        ...(provider.modelCatalog === undefined ? {} : { modelCatalog: provider.modelCatalog }),
      }),
      provider.category || null,
      index + 1,
      index,
      provider.isCurrent ? 1 : 0,
    )
  })
  db.prepare('INSERT INTO proxy_config (app_type, enabled, live_takeover_active) VALUES (?, ?, ?)')
    .run('codex', options.proxyTakeover ? 1 : 0, options.proxyTakeover ? 1 : 0)
  db.close()

  return {
    root,
    ccSwitchHome,
    codexHome,
    settingsPath,
    databasePath,
    configPath,
    authPath,
    paths: { rootDir: ccSwitchHome, databasePath, settingsPath, codexHome, configPath },
  }
}

const officialProvider: FixtureProvider = {
  id: 'official',
  name: 'OpenAI Official',
  category: 'official',
  config: '# official comment\nmodel = "gpt-5"\n',
  auth: {},
  isCurrent: true,
}

const thirdPartyProvider: FixtureProvider = {
  id: 'third-party',
  name: 'Third Party',
  category: '',
  config: [
    '# provider comment',
    'model = "gpt-custom"',
    'model_provider = "custom"',
    '',
    '[model_providers.custom]',
    'name = "Custom"',
    'base_url = "https://example.test/v1"',
    'wire_api = "responses"',
    '',
  ].join('\n'),
  auth: { OPENAI_API_KEY: 'third-party-secret' },
}

describe('CC Switch Codex config projection', () => {
  it('injects a provider-scoped key without discarding comments', () => {
    const providerWithFollowingArrayTable = {
      ...thirdPartyProvider,
      config: `${thirdPartyProvider.config}\n[[skills.config]]\npath = "example/SKILL.md"\n`,
    }
    const projected = projectCcSwitchCodexConfig(providerWithFollowingArrayTable, {
      preserveOfficialAuth: true,
      unifyHistory: true,
    })
    expect(projected).toContain('# provider comment')
    expect(projected).toContain('experimental_bearer_token = "third-party-secret"')
    expect(projected).toContain('requires_openai_auth = true')
    expect(projected.indexOf('experimental_bearer_token')).toBeGreaterThan(projected.indexOf('[model_providers.custom]'))
    expect(projected.indexOf('experimental_bearer_token')).toBeLessThan(projected.indexOf('[[skills.config]]'))
  })

  it('routes official sessions through the CC Switch custom bucket', () => {
    const projected = projectCcSwitchCodexConfig(officialProvider, {
      preserveOfficialAuth: true,
      unifyHistory: true,
    })
    expect(projected).toContain('# official comment')
    expect(projected).toContain('model_provider = "custom"')
    expect(projected).toContain('[model_providers.custom]')
    expect(projected).toContain('requires_openai_auth = true')
    expect(projected).not.toContain('experimental_bearer_token')
  })
})

describe('CC Switch status and switching', () => {
  const liveTest = process.env.CC_SWITCH_LIVE_TEST === '1' ? it : it.skip

  liveTest('reads the installed CC Switch database without exposing secrets', async () => {
    const status = await readCcSwitchStatus()
    expect(status.available).toBe(true)
    expect(status.schemaVersion).toBe(18)
    expect(status.providers.length).toBeGreaterThan(0)
    expect(status.currentProviderId).not.toBe('')
    expect(status.providers.filter((provider) => provider.compatible).length).toBeGreaterThan(0)
    expect(JSON.stringify(status)).not.toContain('OPENAI_API_KEY')
    expect(JSON.stringify(status)).not.toContain('experimental_bearer_token')
  })

  it('returns redacted provider summaries', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
    })
    const status = await readCcSwitchStatus(fixture.paths)
    expect(status.available).toBe(true)
    expect(status.switchable).toBe(true)
    expect(status.currentProviderId).toBe('official')
    expect(status.providers.find((provider) => provider.id === 'third-party')).toMatchObject({
      endpointHost: 'example.test',
      model: 'gpt-custom',
      compatible: true,
    })
    expect(JSON.stringify(status)).not.toContain('third-party-secret')
    expect(JSON.stringify(status)).not.toContain('provider comment')
  })

  it('keeps providers with a CC Switch model catalog switchable', async () => {
    const catalogProvider: FixtureProvider = {
      ...thirdPartyProvider,
      id: 'catalog-provider',
      name: 'Catalog Provider',
      modelCatalog: {
        models: [{ model: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash' }],
      },
    }
    const fixture = await createFixture({
      providers: [officialProvider, catalogProvider],
      currentProviderId: 'official',
    })
    const reloadRuntime = vi.fn(async () => undefined)

    const status = await readCcSwitchStatus(fixture.paths)
    expect(status.providers.find((provider) => provider.id === 'catalog-provider')).toMatchObject({
      compatible: true,
      model: 'gpt-custom',
    })

    await switchCcSwitchProvider('catalog-provider', { paths: fixture.paths, reloadRuntime })
    expect(await readFile(fixture.configPath, 'utf8')).toContain('experimental_bearer_token = "third-party-secret"')
    expect(reloadRuntime).toHaveBeenCalledTimes(1)
  })

  it('switches config and current markers without changing auth.json', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
    })
    const authBefore = await readFile(fixture.authPath)
    const reloadRuntime = vi.fn(async () => undefined)
    const status = await switchCcSwitchProvider('third-party', {
      paths: fixture.paths,
      reloadRuntime,
    })

    expect(status.currentProviderId).toBe('third-party')
    expect(await readFile(fixture.authPath)).toEqual(authBefore)
    expect(await readFile(fixture.configPath, 'utf8')).toContain('experimental_bearer_token = "third-party-secret"')
    const settings = JSON.parse(await readFile(fixture.settingsPath, 'utf8')) as Record<string, unknown>
    expect(settings.currentProviderCodex).toBe('third-party')
    const db = new DatabaseSync(fixture.databasePath, { readOnly: true })
    const currentRows = db.prepare("SELECT id FROM providers WHERE app_type = 'codex' AND is_current = 1").all()
    db.close()
    expect(currentRows).toEqual([{ id: 'third-party' }])
    expect(reloadRuntime).toHaveBeenCalledTimes(1)
  })

  it('rejects a switch based on stale frontend provider state without writing files', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
    })
    const configBefore = await readFile(fixture.configPath, 'utf8')
    const settingsBefore = await readFile(fixture.settingsPath, 'utf8')
    const reloadRuntime = vi.fn(async () => undefined)

    await expect(switchCcSwitchProvider('third-party', {
      paths: fixture.paths,
      reloadRuntime,
      expectedCurrentProviderId: 'stale-deepseek',
    })).rejects.toMatchObject({ code: 'PROVIDER_STATE_CHANGED', statusCode: 409 })

    expect(await readFile(fixture.configPath, 'utf8')).toBe(configBefore)
    expect(await readFile(fixture.settingsPath, 'utf8')).toBe(settingsBefore)
    expect(reloadRuntime).not.toHaveBeenCalled()
  })

  it('retries an external provider change after runtime becomes idle', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
    })
    let blocked = true
    const reloadRuntime = vi.fn(async () => undefined)
    const watcher = watchCcSwitchExternalChanges({
      paths: fixture.paths,
      reloadRuntime,
      isBlocked: () => blocked ? 'busy' : '',
      debounceMs: 5,
      retryMs: 10,
    })

    try {
      await new Promise((resolve) => setTimeout(resolve, 25))
      await writeFile(fixture.settingsPath, `${JSON.stringify({
        preserveCodexOfficialAuthOnSwitch: true,
        unifyCodexSessionHistory: true,
        currentProviderCodex: 'third-party',
      }, null, 2)}\n`, 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 35))
      expect(reloadRuntime).not.toHaveBeenCalled()

      blocked = false
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(reloadRuntime).toHaveBeenCalledTimes(1)
    } finally {
      watcher.close()
    }
  })

  it('restores config and CC Switch state when runtime reload fails', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
    })
    const configBefore = await readFile(fixture.configPath, 'utf8')
    const settingsBefore = await readFile(fixture.settingsPath, 'utf8')
    const authBefore = await readFile(fixture.authPath)
    const reloadRuntime = vi.fn()
      .mockRejectedValueOnce(new Error('reload failed'))
      .mockResolvedValueOnce(undefined)

    await expect(switchCcSwitchProvider('third-party', {
      paths: fixture.paths,
      reloadRuntime,
    })).rejects.toThrow('reload failed')

    expect(await readFile(fixture.configPath, 'utf8')).toBe(configBefore)
    expect(await readFile(fixture.settingsPath, 'utf8')).toBe(settingsBefore)
    expect(await readFile(fixture.authPath)).toEqual(authBefore)
    const db = new DatabaseSync(fixture.databasePath, { readOnly: true })
    const currentRows = db.prepare("SELECT id FROM providers WHERE app_type = 'codex' AND is_current = 1").all()
    db.close()
    expect(currentRows).toEqual([{ id: 'official' }])
    expect(reloadRuntime).toHaveBeenCalledTimes(2)
  })

  it('refuses switching while CC Switch proxy takeover is active', async () => {
    const fixture = await createFixture({
      providers: [officialProvider, thirdPartyProvider],
      currentProviderId: 'official',
      proxyTakeover: true,
    })
    const status = await readCcSwitchStatus(fixture.paths)
    expect(status.switchable).toBe(false)
    expect(status.proxyTakeoverActive).toBe(true)
    await expect(switchCcSwitchProvider('third-party', {
      paths: fixture.paths,
      reloadRuntime: async () => undefined,
    })).rejects.toThrow('proxy takeover')
  })

  it('falls back to read-only unavailable state for an unknown schema', async () => {
    const fixture = await createFixture({
      providers: [officialProvider],
      currentProviderId: 'official',
      schemaVersion: 19,
    })
    const status = await readCcSwitchStatus(fixture.paths)
    expect(status.available).toBe(false)
    expect(status.switchable).toBe(false)
    expect(status.reason).toContain('schema 19')
  })
})
