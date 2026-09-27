import { randomUUID } from 'node:crypto'
import { existsSync, watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { parse as parseToml } from 'smol-toml'

const SUPPORTED_SCHEMA_VERSION = 18
const APP_TYPE = 'codex'

type SqliteStatement = {
  all(...params: unknown[]): unknown[]
  get(...params: unknown[]): unknown
  run(...params: unknown[]): { changes: number | bigint }
}

type SqliteDatabase = {
  close(): void
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
}

type CcSwitchPaths = {
  rootDir: string
  databasePath: string
  settingsPath: string
  codexHome: string
  configPath: string
}

type StoredProvider = {
  id: string
  name: string
  category: string
  isCurrent: boolean
  config: string
  auth: Record<string, unknown>
  settingsConfig: Record<string, unknown>
}

type LoadedCcSwitchState = {
  paths: CcSwitchPaths
  schemaVersion: number
  settings: Record<string, unknown>
  settingsRaw: string
  providers: StoredProvider[]
  currentProviderId: string
  currentDatabaseProviderIds: string[]
  preserveOfficialAuth: boolean
  unifyHistory: boolean
  proxyTakeoverActive: boolean
}

export type CcSwitchProviderSummary = {
  id: string
  name: string
  category: 'official' | 'third-party'
  current: boolean
  compatible: boolean
  incompatibilityReason: string
  model: string
  endpointHost: string
}

export type CcSwitchStatus = {
  available: boolean
  switchable: boolean
  reason: string
  schemaVersion: number | null
  currentProviderId: string
  preserveOfficialAuth: boolean
  unifyHistory: boolean
  proxyTakeoverActive: boolean
  switchingProviderId: string
  providers: CcSwitchProviderSummary[]
}

type RuntimeConfigurationController = {
  beginRuntimeConfigurationChange(): () => void
  getRuntimeConfigurationChangeBlockReason(): string
  reload(): Promise<void>
}

type ReadJsonBody = (req: IncomingMessage) => Promise<unknown>

type CcSwitchRouteContext = {
  appServer: RuntimeConfigurationController
  readJsonBody: ReadJsonBody
}

type SwitchOptions = {
  reloadRuntime: () => Promise<void>
  paths?: CcSwitchPaths
  expectedCurrentProviderId?: string
}

type PreparedModelCatalogRepair = {
  config: string
  catalogPath: string | null
  previousCatalog: string | null
  nextCatalog: string | null
  changed: boolean
}

class CcSwitchIntegrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'CcSwitchIntegrationError'
  }
}

let switchingProviderId = ''
let switchMutation: Promise<void> = Promise.resolve()

export type CcSwitchExternalChangeWatcher = {
  close(): void
}

type ExternalChangeWatcherOptions = {
  paths?: CcSwitchPaths
  reloadRuntime: () => Promise<void>
  isBlocked: () => string
  debounceMs?: number
  retryMs?: number
}

function getStatusSignature(status: CcSwitchStatus): string {
  return JSON.stringify({
    available: status.available,
    currentProviderId: status.currentProviderId,
    providers: status.providers.map((provider) => ({
      id: provider.id,
      current: provider.current,
      compatible: provider.compatible,
      model: provider.model,
      endpointHost: provider.endpointHost,
    })),
  })
}

export function watchCcSwitchExternalChanges(
  options: ExternalChangeWatcherOptions,
): CcSwitchExternalChangeWatcher {
  const paths = options.paths ?? getCcSwitchPaths()
  const watchedFiles = new Set([
    basename(paths.databasePath),
    basename(paths.settingsPath),
    basename(paths.configPath),
  ])
  const watchers: FSWatcher[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  let lastAppliedSignature = ''
  let checkPromise: Promise<void> | null = null

  const schedule = (): void => {
    if (closed) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void checkAndReload()
    }, options.debounceMs ?? 500)
  }

  const checkAndReload = async (): Promise<void> => {
    if (closed) return
    if (checkPromise) return await checkPromise
    checkPromise = (async () => {
      const status = await readCcSwitchStatus(paths)
      const signature = getStatusSignature(status)
      if (signature === lastAppliedSignature) return
      if (!status.available) {
        lastAppliedSignature = signature
        return
      }

      const blockReason = options.isBlocked()
      if (blockReason) {
        if (!closed) {
          timer = setTimeout(() => {
            timer = null
            void checkAndReload()
          }, options.retryMs ?? 1000)
        }
        return
      }

      try {
        await options.reloadRuntime()
        lastAppliedSignature = signature
      } catch {
        if (!closed) {
          timer = setTimeout(() => {
            timer = null
            void checkAndReload()
          }, options.retryMs ?? 1000)
        }
      }
    })().finally(() => {
      checkPromise = null
    })
    await checkPromise
  }

  const onChange = (filename: string | null): void => {
    if (!filename || watchedFiles.has(basename(filename))) schedule()
  }

  for (const directory of new Set([dirname(paths.databasePath), dirname(paths.configPath)])) {
    try {
      watchers.push(watch(directory, { persistent: false }, (_eventType, filename) => onChange(filename)))
    } catch {
      // CC Switch may not be installed yet; status remains available on demand.
    }
  }

  void readCcSwitchStatus(paths).then((status) => {
    lastAppliedSignature = getStatusSignature(status)
  })

  return {
    close: () => {
      closed = true
      if (timer) clearTimeout(timer)
      timer = null
      watchers.forEach((entry) => entry.close())
      watchers.length = 0
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readBoolean(value: unknown): boolean {
  return value === true
}

function getCcSwitchPaths(): CcSwitchPaths {
  const rootDir = process.env.CC_SWITCH_HOME?.trim() || join(homedir(), '.cc-switch')
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  return {
    rootDir,
    databasePath: join(rootDir, 'cc-switch.db'),
    settingsPath: join(rootDir, 'settings.json'),
    codexHome,
    configPath: join(codexHome, 'config.toml'),
  }
}

async function openDatabase(databasePath: string, readOnly: boolean): Promise<SqliteDatabase> {
  try {
    // Keep this specifier dynamic: esbuild rewrites a literal `node:sqlite`
    // import to the unrelated npm package `sqlite` when targeting Node 18.
    const sqliteSpecifier = ['node', 'sqlite'].join(':')
    const sqlite = await import(sqliteSpecifier)
    return new sqlite.DatabaseSync(databasePath, { readOnly }) as unknown as SqliteDatabase
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CcSwitchIntegrationError(
      'SQLITE_UNAVAILABLE',
      `CC Switch integration requires Node.js 22.5 or newer (${message}).`,
      503,
    )
  }
}

function readSchemaVersion(db: SqliteDatabase): number {
  const row = asRecord(db.prepare('PRAGMA user_version').get())
  const value = row?.user_version
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function assertSupportedSchema(db: SqliteDatabase): number {
  const schemaVersion = readSchemaVersion(db)
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new CcSwitchIntegrationError(
      'UNSUPPORTED_SCHEMA',
      `CC Switch database schema ${schemaVersion} is not supported. Expected schema ${SUPPORTED_SCHEMA_VERSION}.`,
      409,
    )
  }

  const providerColumns = new Set(db.prepare('PRAGMA table_info(providers)').all()
    .map((row) => readString(asRecord(row)?.name)))
  const requiredProviderColumns = ['id', 'app_type', 'name', 'settings_config', 'category', 'is_current']
  if (requiredProviderColumns.some((column) => !providerColumns.has(column))) {
    throw new CcSwitchIntegrationError(
      'UNSUPPORTED_SCHEMA',
      'CC Switch provider table does not match the verified schema.',
      409,
    )
  }
  return schemaVersion
}

function parseStoredProvider(rowValue: unknown): StoredProvider | null {
  const row = asRecord(rowValue)
  const id = readString(row?.id)
  const name = readString(row?.name)
  const rawSettingsConfig = readString(row?.settings_config)
  if (!id || !name || !rawSettingsConfig) return null

  let settingsConfig: Record<string, unknown>
  try {
    settingsConfig = asRecord(JSON.parse(rawSettingsConfig)) ?? {}
  } catch {
    settingsConfig = {}
  }

  return {
    id,
    name,
    category: readString(row?.category),
    isCurrent: Number(row?.is_current ?? 0) === 1,
    config: typeof settingsConfig.config === 'string' ? settingsConfig.config : '',
    auth: asRecord(settingsConfig.auth) ?? {},
    settingsConfig,
  }
}

function readProxyTakeoverState(db: SqliteDatabase): boolean {
  const proxyColumns = new Set(db.prepare('PRAGMA table_info(proxy_config)').all()
    .map((row) => readString(asRecord(row)?.name)))
  if (!proxyColumns.has('live_takeover_active') || !proxyColumns.has('enabled')) {
    throw new CcSwitchIntegrationError(
      'UNSUPPORTED_SCHEMA',
      'CC Switch proxy table does not match the verified schema.',
      409,
    )
  }
  const proxyRow = asRecord(db.prepare(
    'SELECT enabled, live_takeover_active FROM proxy_config WHERE app_type = ?',
  ).get(APP_TYPE))
  const backupRow = asRecord(db.prepare(
    'SELECT COUNT(*) AS count FROM proxy_live_backup WHERE app_type = ?',
  ).get(APP_TYPE))
  return Number(proxyRow?.enabled ?? 0) === 1
    || Number(proxyRow?.live_takeover_active ?? 0) === 1
    || Number(backupRow?.count ?? 0) > 0
}

async function loadCcSwitchState(paths = getCcSwitchPaths()): Promise<LoadedCcSwitchState> {
  if (!existsSync(paths.databasePath) || !existsSync(paths.settingsPath)) {
    throw new CcSwitchIntegrationError(
      'CC_SWITCH_NOT_FOUND',
      `CC Switch data was not found in ${paths.rootDir}.`,
      404,
    )
  }

  const settingsRaw = await readFile(paths.settingsPath, 'utf8')
  const settings = asRecord(JSON.parse(settingsRaw))
  if (!settings) {
    throw new CcSwitchIntegrationError('INVALID_SETTINGS', 'CC Switch settings.json is invalid.', 409)
  }

  const db = await openDatabase(paths.databasePath, true)
  try {
    db.exec('PRAGMA busy_timeout = 3000')
    const schemaVersion = assertSupportedSchema(db)
    const providers = db.prepare(`
      SELECT id, name, category, settings_config, is_current
      FROM providers
      WHERE app_type = ?
      ORDER BY sort_index ASC, created_at ASC, name ASC
    `).all(APP_TYPE).map(parseStoredProvider).filter((provider): provider is StoredProvider => provider !== null)
    const requestedCurrentId = readString(settings.currentProviderCodex)
    const effectiveCurrent = providers.some((provider) => provider.id === requestedCurrentId)
      ? requestedCurrentId
      : providers.find((provider) => provider.isCurrent)?.id ?? ''

    return {
      paths,
      schemaVersion,
      settings,
      settingsRaw,
      providers,
      currentProviderId: effectiveCurrent,
      currentDatabaseProviderIds: providers.filter((provider) => provider.isCurrent).map((provider) => provider.id),
      preserveOfficialAuth: readBoolean(settings.preserveCodexOfficialAuthOnSwitch),
      unifyHistory: readBoolean(settings.unifyCodexSessionHistory),
      proxyTakeoverActive: readProxyTakeoverState(db),
    }
  } finally {
    db.close()
  }
}

function parseConfig(config: string): Record<string, unknown> {
  if (!config.trim()) {
    throw new CcSwitchIntegrationError('INVALID_PROVIDER', 'The selected provider has no Codex config.toml content.', 409)
  }
  try {
    return asRecord(parseToml(config)) ?? {}
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CcSwitchIntegrationError('INVALID_PROVIDER', `The selected provider has invalid TOML: ${message}`, 409)
  }
}

function findTableHeaderPath(line: string): string[] | null {
  if (!/^\s*\[[^[][^\]]*\]\s*(?:#.*)?$/.test(line)) return null
  try {
    const marker = '__codex_mobile_table_marker__'
    const parsed = asRecord(parseToml(`${line}\n${marker} = true\n`))
    if (!parsed) return null
    const find = (record: Record<string, unknown>, prefix: string[]): string[] | null => {
      if (record[marker] === true) return prefix
      for (const [key, value] of Object.entries(record)) {
        const nested = asRecord(value)
        if (!nested) continue
        const found = find(nested, [...prefix, key])
        if (found) return found
      }
      return null
    }
    return find(parsed, [])
  } catch {
    return null
  }
}

function isAnyTableHeader(line: string): boolean {
  return /^\s*\[\[?.+\]\]?\s*(?:#.*)?$/.test(line)
}

function tablePathsEqual(left: string[] | null, right: string[]): boolean {
  return left !== null && left.length === right.length && left.every((part, index) => part === right[index])
}

function replaceLines(config: string, lines: string[]): string {
  const trailingNewline = config.endsWith('\n')
  const result = lines.join('\n')
  return trailingNewline ? `${result}\n` : result
}

function upsertTableField(config: string, tablePath: string[], field: string, literal: string): string {
  parseConfig(config)
  const lines = config.replace(/\r\n/g, '\n').split('\n')
  let tableStart = -1
  let tableEnd = lines.length
  for (let index = 0; index < lines.length; index += 1) {
    if (!isAnyTableHeader(lines[index])) continue
    const headerPath = findTableHeaderPath(lines[index])
    if (tableStart >= 0) {
      tableEnd = index
      break
    }
    if (tablePathsEqual(headerPath, tablePath)) tableStart = index
  }
  if (tableStart < 0) {
    throw new CcSwitchIntegrationError(
      'UNSUPPORTED_PROVIDER_CONFIG',
      `The provider table [${tablePath.join('.')}] must use a standard TOML table.`,
      409,
    )
  }

  const fieldPattern = new RegExp(`^\\s*${field.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=`)
  for (let index = tableStart + 1; index < tableEnd; index += 1) {
    if (!fieldPattern.test(lines[index])) continue
    const indent = lines[index].match(/^\s*/)?.[0] ?? ''
    lines[index] = `${indent}${field} = ${literal}`
    const next = replaceLines(config, lines)
    parseConfig(next)
    return next
  }

  lines.splice(tableEnd, 0, `${field} = ${literal}`)
  const next = replaceLines(config, lines)
  parseConfig(next)
  return next
}

function insertTopLevelField(config: string, field: string, literal: string): string {
  parseConfig(config)
  const lines = config.replace(/\r\n/g, '\n').split('\n')
  const fieldPattern = new RegExp(`^\\s*${field.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=`)
  let firstTableIndex = lines.length
  for (let index = 0; index < lines.length; index += 1) {
    if (isAnyTableHeader(lines[index])) {
      firstTableIndex = index
      break
    }
    if (fieldPattern.test(lines[index])) {
      lines[index] = `${field} = ${literal}`
      const next = replaceLines(config, lines)
      parseConfig(next)
      return next
    }
  }
  lines.splice(firstTableIndex, 0, `${field} = ${literal}`)
  const next = replaceLines(config, lines)
  parseConfig(next)
  return next
}

function appendOfficialUnifiedProvider(config: string): string {
  const separator = config.endsWith('\n') ? '\n' : '\n\n'
  const next = `${config}${separator}[model_providers.custom]\nname = "OpenAI"\nrequires_openai_auth = true\nsupports_websockets = false\nwire_api = "responses"\n`
  parseConfig(next)
  return next
}

function isOfficialUnifiedProviderTable(value: unknown): boolean {
  const table = asRecord(value)
  return Boolean(table
    && Object.keys(table).length === 4
    && table.name === 'OpenAI'
    && table.requires_openai_auth === true
    && typeof table.supports_websockets === 'boolean'
    && table.wire_api === 'responses')
}

function injectOfficialUnifiedHistoryRoute(config: string): string {
  const parsed = parseConfig(config)
  const configuredProvider = typeof parsed.model_provider === 'string' ? parsed.model_provider.trim() : ''
  if (configuredProvider && configuredProvider !== 'custom') return config
  const modelProviders = asRecord(parsed.model_providers)
  const existingCustom = modelProviders?.custom
  if (existingCustom !== undefined && !isOfficialUnifiedProviderTable(existingCustom)) return config

  let next = config
  if (!configuredProvider) next = insertTopLevelField(next, 'model_provider', '"custom"')
  if (existingCustom === undefined) return appendOfficialUnifiedProvider(next)
  return upsertTableField(next, ['model_providers', 'custom'], 'supports_websockets', 'false')
}

function getActiveProviderTable(parsed: Record<string, unknown>): {
  providerId: string
  table: Record<string, unknown>
} | null {
  const providerId = readString(parsed.model_provider)
  const providers = asRecord(parsed.model_providers)
  const table = providers ? asRecord(providers[providerId]) : null
  return providerId && table ? { providerId, table } : null
}

function getProviderCompatibility(provider: StoredProvider, state: LoadedCcSwitchState): string {
  if (!provider.config.trim()) return 'Missing config.toml content.'
  try {
    projectCcSwitchCodexConfig(provider, state)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function projectCcSwitchCodexConfig(
  provider: Pick<StoredProvider, 'category' | 'config' | 'auth'>,
  settings: Pick<LoadedCcSwitchState, 'preserveOfficialAuth' | 'unifyHistory'>,
): string {
  let config = provider.config
  if (provider.category === 'official') {
    return settings.unifyHistory ? injectOfficialUnifiedHistoryRoute(config) : config
  }

  let parsed = parseConfig(config)
  const active = getActiveProviderTable(parsed)
  const apiKey = readString(provider.auth.OPENAI_API_KEY)
  if (apiKey) {
    if (!active) {
      throw new CcSwitchIntegrationError(
        'UNSUPPORTED_PROVIDER_CONFIG',
        'Third-party providers with an API key must define an active model_providers table.',
        409,
      )
    }
    if (active.table.experimental_bearer_token === undefined && active.table.env_key === undefined) {
      config = upsertTableField(
        config,
        ['model_providers', active.providerId],
        'experimental_bearer_token',
        JSON.stringify(apiKey),
      )
      parsed = parseConfig(config)
    }
  }

  const projectedActive = getActiveProviderTable(parsed)
  if (projectedActive) {
    const hasProviderAuth = projectedActive.table.experimental_bearer_token !== undefined
      || projectedActive.table.env_key !== undefined
    if (hasProviderAuth) {
      config = upsertTableField(
        config,
        ['model_providers', projectedActive.providerId],
        'requires_openai_auth',
        settings.preserveOfficialAuth ? 'true' : 'false',
      )
    } else if (projectedActive.table.requires_openai_auth === true && readString(projectedActive.table.base_url)) {
      throw new CcSwitchIntegrationError(
        'UNSAFE_PROVIDER_AUTH',
        'This third-party provider would send the official Codex login to a custom endpoint.',
        409,
      )
    }
  } else if (readString(parsed.openai_base_url)) {
    throw new CcSwitchIntegrationError(
      'UNSAFE_PROVIDER_AUTH',
      'Legacy openai_base_url providers must be switched in CC Switch.',
      409,
    )
  }

  parseConfig(config)
  return config
}

function summarizeProvider(provider: StoredProvider, state: LoadedCcSwitchState): CcSwitchProviderSummary {
  let model = ''
  let endpointHost = provider.category === 'official' ? 'api.openai.com' : ''
  try {
    const parsed = parseConfig(provider.config)
    model = readString(parsed.model)
    const active = getActiveProviderTable(parsed)
    const baseUrl = active ? readString(active.table.base_url) : readString(parsed.openai_base_url)
    if (baseUrl) endpointHost = new URL(baseUrl).host
  } catch {
    // Compatibility details are returned separately.
  }
  const incompatibilityReason = getProviderCompatibility(provider, state)
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category === 'official' ? 'official' : 'third-party',
    current: provider.id === state.currentProviderId,
    compatible: !incompatibilityReason,
    incompatibilityReason,
    model,
    endpointHost,
  }
}

export async function readCcSwitchStatus(paths = getCcSwitchPaths()): Promise<CcSwitchStatus> {
  try {
    const state = await loadCcSwitchState(paths)
    const providers = state.providers.map((provider) => summarizeProvider(provider, state))
    const compatibleProviders = providers.filter((provider) => provider.compatible)
    const reason = state.proxyTakeoverActive
      ? 'Disable CC Switch proxy takeover before switching providers from CodexMobile.'
      : compatibleProviders.length === 0
        ? 'No compatible Codex providers were found in CC Switch.'
        : ''
    return {
      available: true,
      switchable: !reason,
      reason,
      schemaVersion: state.schemaVersion,
      currentProviderId: state.currentProviderId,
      preserveOfficialAuth: state.preserveOfficialAuth,
      unifyHistory: state.unifyHistory,
      proxyTakeoverActive: state.proxyTakeoverActive,
      switchingProviderId,
      providers,
    }
  } catch (error) {
    return {
      available: false,
      switchable: false,
      reason: error instanceof Error ? error.message : String(error),
      schemaVersion: null,
      currentProviderId: '',
      preserveOfficialAuth: false,
      unifyHistory: false,
      proxyTakeoverActive: false,
      switchingProviderId,
      providers: [],
    }
  }
}

async function atomicWriteText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`)
  await writeFile(tempPath, content, 'utf8')
  try {
    await rename(tempPath, path)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (asRecord(error)?.code === 'ENOENT') return null
    throw error
  }
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function getCatalogModels(root: unknown): Record<string, unknown>[] {
  if (Array.isArray(root)) return root.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
  const record = asRecord(root)
  if (!record || !Array.isArray(record.models)) return []
  return record.models.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
}

function readCatalogModelId(model: Record<string, unknown>): string {
  return readString(model.slug) || readString(model.model) || readString(model.id)
}

function getProviderCatalogModel(provider: StoredProvider, modelId: string): Record<string, unknown> | null {
  const catalog = asRecord(provider.settingsConfig.modelCatalog)
  if (!catalog || !Array.isArray(catalog.models)) return null
  for (const rawModel of catalog.models) {
    const model = asRecord(rawModel)
    if (!model) continue
    if (readCatalogModelId(model) === modelId) return model
  }
  return null
}

function reasoningLevelDescription(level: string): string {
  if (level === 'low') return 'Fast responses with lighter reasoning'
  if (level === 'medium') return 'Balances speed and reasoning depth for everyday tasks'
  if (level === 'high') return 'Greater reasoning depth for complex problems'
  if (level === 'xhigh') return 'Extra high reasoning depth for complex problems'
  if (level === 'max') return 'Maximum reasoning depth for the hardest problems'
  if (level === 'ultra') return 'Maximum reasoning with automatic task delegation'
  return `${level} reasoning effort`
}

function applyProviderModelIdentity(
  model: Record<string, unknown>,
  modelId: string,
  providerModel: Record<string, unknown> | null,
): Record<string, unknown> {
  const next = cloneRecord(model)
  const displayName = readString(providerModel?.displayName)
    || readString(providerModel?.display_name)
    || modelId
  const contextWindow = readPositiveNumber(providerModel?.contextWindow ?? providerModel?.context_window)
  const reasoningLevels = Array.isArray(providerModel?.reasoningLevels)
    ? providerModel.reasoningLevels.map(readString).filter(Boolean)
    : Array.isArray(providerModel?.reasoning_levels)
      ? providerModel.reasoning_levels.map(readString).filter(Boolean)
      : []

  next.slug = modelId
  next.display_name = displayName
  next.description = readString(providerModel?.description) || `${displayName} via a third-party Codex provider.`
  next.visibility = 'list'
  next.supported_in_api = true
  next.upgrade = null

  if (contextWindow) {
    next.context_window = contextWindow
    next.max_context_window = contextWindow
  }

  if (reasoningLevels.length > 0) {
    next.supported_reasoning_levels = reasoningLevels.map((effort) => ({
      effort,
      description: reasoningLevelDescription(effort),
    }))
    next.default_reasoning_level = reasoningLevels.includes('high')
      ? 'high'
      : reasoningLevels.includes('medium')
        ? 'medium'
        : reasoningLevels[0]
  }

  // Hosted/provider capabilities are deliberately conservative. Codex-local
  // tools are applied separately below.
  if (providerModel && Array.isArray(providerModel.inputModalities)) {
    next.input_modalities = providerModel.inputModalities.map(readString).filter(Boolean)
  } else {
    next.input_modalities = ['text']
  }
  next.supports_search_tool = readBoolean(providerModel?.supportsSearchTool)
  next.supports_image_detail_original = readBoolean(providerModel?.supportsImageDetailOriginal)
  next.use_responses_lite = false
  next.web_search_tool_type = 'text'
  next.experimental_supported_tools = []
  next.tool_mode = null

  return next
}

function applyCodexNativeToolProfile(model: Record<string, unknown>): Record<string, unknown> {
  return {
    ...model,
    shell_type: 'unified_exec',
    apply_patch_tool_type: 'freeform',
    multi_agent_version: 'v2',
    supports_parallel_tool_calls: true,
    include_skills_usage_instructions: true,
    include_plugin_usage_instructions: true,
    include_apps_usage_instructions: true,
    node_repl_disabled: false,
    node_repl_auto_review_required: false,
  }
}

async function loadOfficialCodingTemplate(codexHome: string): Promise<Record<string, unknown>> {
  const raw = await readOptionalText(join(codexHome, 'models_cache.json'))
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      const models = getCatalogModels(parsed)
      for (const preferredId of ['gpt-5.5', 'gpt-5.6-sol', 'gpt-6-sol']) {
        const preferred = models.find((model) => readCatalogModelId(model) === preferredId)
        if (preferred) return cloneRecord(preferred)
      }
      const codingModel = models.find((model) => (
        readString(model.apply_patch_tool_type) === 'freeform'
        && ['unified_exec', 'shell_command'].includes(readString(model.shell_type))
      ))
      if (codingModel) return cloneRecord(codingModel)
    } catch {
      // Fall through to a compact schema-compatible template.
    }
  }

  return {
    slug: '',
    display_name: '',
    description: '',
    visibility: 'list',
    supported_in_api: true,
    priority: 1000,
    upgrade: null,
    context_window: 128000,
    max_context_window: 128000,
    effective_context_window_percent: 95,
    default_reasoning_level: 'medium',
    default_reasoning_summary: 'none',
    default_verbosity: 'low',
    supported_reasoning_levels: [
      { effort: 'low', description: reasoningLevelDescription('low') },
      { effort: 'medium', description: reasoningLevelDescription('medium') },
      { effort: 'high', description: reasoningLevelDescription('high') },
    ],
    input_modalities: ['text'],
    supports_search_tool: false,
    supports_image_detail_original: false,
    supports_reasoning_summaries: true,
    experimental_supported_tools: [],
    use_responses_lite: false,
    web_search_tool_type: 'text',
  }
}

function parseModelCatalog(raw: string | null, catalogPath: string): Record<string, unknown> {
  if (raw === null || !raw.trim()) return { models: [] }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return { models: parsed }
    const record = asRecord(parsed)
    if (!record) throw new Error('root is not an object')
    return record
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CcSwitchIntegrationError(
      'INVALID_MODEL_CATALOG',
      `Model catalog ${catalogPath} is invalid JSON: ${message}`,
      409,
    )
  }
}

async function prepareThirdPartyModelCatalogRepair(
  provider: StoredProvider,
  projectedConfig: string,
  paths: CcSwitchPaths,
): Promise<PreparedModelCatalogRepair> {
  if (provider.category === 'official') {
    return { config: projectedConfig, catalogPath: null, previousCatalog: null, nextCatalog: null, changed: false }
  }

  let config = projectedConfig
  let parsedConfig = parseConfig(config)
  const modelId = readString(parsedConfig.model)
  if (!modelId) {
    return { config, catalogPath: null, previousCatalog: null, nextCatalog: null, changed: false }
  }

  let configuredCatalogPath = readString(parsedConfig.model_catalog_json)
  if (!configuredCatalogPath) {
    configuredCatalogPath = join(paths.codexHome, 'codex-mobile-model-catalog.json')
    config = insertTopLevelField(config, 'model_catalog_json', JSON.stringify(configuredCatalogPath))
    parsedConfig = parseConfig(config)
  }
  const catalogPath = isAbsolute(configuredCatalogPath)
    ? configuredCatalogPath
    : join(paths.codexHome, configuredCatalogPath)
  const previousCatalog = await readOptionalText(catalogPath)
  const catalog = parseModelCatalog(previousCatalog, catalogPath)
  const rawModels = Array.isArray(catalog.models) ? catalog.models : []
  const models = rawModels.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
  const existingIndex = models.findIndex((model) => readCatalogModelId(model) === modelId)
  const providerModel = getProviderCatalogModel(provider, modelId)

  let nextModel: Record<string, unknown>
  if (existingIndex >= 0) {
    nextModel = cloneRecord(models[existingIndex])
  } else {
    const localTemplate = models.find((model) => (
      readString(model.apply_patch_tool_type) === 'freeform'
      || ['unified_exec', 'shell_command'].includes(readString(model.shell_type))
    ))
    const template = localTemplate ? cloneRecord(localTemplate) : await loadOfficialCodingTemplate(paths.codexHome)
    nextModel = applyProviderModelIdentity(template, modelId, providerModel)
  }
  nextModel = applyCodexNativeToolProfile(nextModel)

  const nextModels = [...models]
  if (existingIndex >= 0) nextModels[existingIndex] = nextModel
  else nextModels.push(nextModel)
  const nextCatalogRoot = { ...catalog, models: nextModels }
  const nextCatalog = `${JSON.stringify(nextCatalogRoot, null, 2)}\n`
  const changed = previousCatalog !== nextCatalog || readString(parsedConfig.model_catalog_json) !== configuredCatalogPath

  return { config, catalogPath, previousCatalog, nextCatalog, changed }
}

async function updateDatabaseCurrent(databasePath: string, providerIds: string[]): Promise<void> {
  const db = await openDatabase(databasePath, false)
  try {
    db.exec('PRAGMA busy_timeout = 3000')
    assertSupportedSchema(db)
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE providers SET is_current = 0 WHERE app_type = ?').run(APP_TYPE)
      const update = db.prepare('UPDATE providers SET is_current = 1 WHERE app_type = ? AND id = ?')
      for (const providerId of providerIds) update.run(APP_TYPE, providerId)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } finally {
    db.close()
  }
}

async function restoreOptionalText(path: string, content: string | null): Promise<void> {
  if (content === null) {
    await rm(path, { force: true })
    return
  }
  await atomicWriteText(path, content)
}

async function switchProviderInternal(providerId: string, options: SwitchOptions): Promise<CcSwitchStatus> {
  const state = await loadCcSwitchState(options.paths)
  if (state.proxyTakeoverActive) {
    throw new CcSwitchIntegrationError(
      'PROXY_TAKEOVER_ACTIVE',
      'Disable CC Switch proxy takeover before switching providers from CodexMobile.',
      409,
    )
  }
  const provider = state.providers.find((entry) => entry.id === providerId)
  if (!provider) throw new CcSwitchIntegrationError('PROVIDER_NOT_FOUND', 'CC Switch provider was not found.', 404)
  const incompatibilityReason = getProviderCompatibility(provider, state)
  if (incompatibilityReason) {
    throw new CcSwitchIntegrationError('UNSUPPORTED_PROVIDER', incompatibilityReason, 409)
  }
  if (options.expectedCurrentProviderId && options.expectedCurrentProviderId !== state.currentProviderId) {
    throw new CcSwitchIntegrationError(
      'PROVIDER_STATE_CHANGED',
      `CC Switch provider changed from ${options.expectedCurrentProviderId} to ${state.currentProviderId}. Refresh provider state before switching.`,
      409,
    )
  }

  const previousConfig = await readOptionalText(state.paths.configPath)
  const projectedConfig = projectCcSwitchCodexConfig(provider, state)
  let repairBaseConfig = projectedConfig
  if (state.currentProviderId === providerId && previousConfig) {
    try {
      const currentParsed = parseConfig(previousConfig)
      const projectedParsed = parseConfig(projectedConfig)
      const currentModel = readString(currentParsed.model)
      const projectedModel = readString(projectedParsed.model)
      const currentProvider = readString(currentParsed.model_provider)
      const projectedProvider = readString(projectedParsed.model_provider)
      if (currentModel === projectedModel && currentProvider === projectedProvider) {
        repairBaseConfig = provider.category === 'official' && state.unifyHistory
          ? injectOfficialUnifiedHistoryRoute(previousConfig)
          : previousConfig
      }
    } catch {
      // A malformed/stale current config is repaired from the provider projection.
    }
  }
  const catalogRepair = await prepareThirdPartyModelCatalogRepair(provider, repairBaseConfig, state.paths)
  const nextConfig = catalogRepair.config
  if (state.currentProviderId === providerId && !catalogRepair.changed && previousConfig === nextConfig) {
    return await readCcSwitchStatus(state.paths)
  }
  const previousSettings = state.settingsRaw
  const nextSettings = {
    ...state.settings,
    currentProviderCodex: providerId,
  }

  let configWritten = false
  let catalogWritten = false
  let settingsWritten = false
  let databaseWritten = false
  try {
    if (catalogRepair.catalogPath && catalogRepair.nextCatalog && catalogRepair.changed) {
      await atomicWriteText(catalogRepair.catalogPath, catalogRepair.nextCatalog)
      catalogWritten = true
    }
    await atomicWriteText(state.paths.configPath, nextConfig)
    configWritten = true
    await atomicWriteText(state.paths.settingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`)
    settingsWritten = true
    await updateDatabaseCurrent(state.paths.databasePath, [providerId])
    databaseWritten = true
    await options.reloadRuntime()
    return await readCcSwitchStatus(state.paths)
  } catch (error) {
    const rollbackErrors: string[] = []
    if (databaseWritten) {
      try { await updateDatabaseCurrent(state.paths.databasePath, state.currentDatabaseProviderIds) } catch (rollbackError) {
        rollbackErrors.push(`database: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    if (settingsWritten) {
      try { await atomicWriteText(state.paths.settingsPath, previousSettings) } catch (rollbackError) {
        rollbackErrors.push(`settings: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    if (configWritten) {
      try { await restoreOptionalText(state.paths.configPath, previousConfig) } catch (rollbackError) {
        rollbackErrors.push(`config: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    if (catalogWritten && catalogRepair.catalogPath) {
      try { await restoreOptionalText(catalogRepair.catalogPath, catalogRepair.previousCatalog) } catch (rollbackError) {
        rollbackErrors.push(`catalog: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    try { await options.reloadRuntime() } catch (rollbackError) {
      rollbackErrors.push(`runtime: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
    }
    const originalMessage = error instanceof Error ? error.message : String(error)
    const rollbackSuffix = rollbackErrors.length > 0 ? ` Rollback errors: ${rollbackErrors.join('; ')}` : ''
    throw new CcSwitchIntegrationError('SWITCH_FAILED', `Failed to switch CC Switch provider: ${originalMessage}.${rollbackSuffix}`, 500)
  }
}

export async function switchCcSwitchProvider(providerId: string, options: SwitchOptions): Promise<CcSwitchStatus> {
  const normalizedProviderId = providerId.trim()
  if (!normalizedProviderId) {
    throw new CcSwitchIntegrationError('INVALID_PROVIDER_ID', 'providerId is required.', 400)
  }

  let result: CcSwitchStatus | null = null
  let failure: unknown = null
  const mutation = switchMutation.then(async () => {
    switchingProviderId = normalizedProviderId
    try {
      result = await switchProviderInternal(normalizedProviderId, options)
    } catch (error) {
      failure = error
    } finally {
      switchingProviderId = ''
    }
  })
  switchMutation = mutation.then(() => undefined, () => undefined)
  await mutation
  if (failure) throw failure
  if (!result) throw new CcSwitchIntegrationError('SWITCH_FAILED', 'CC Switch provider switch did not complete.', 500)
  return result
}

function setJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function getErrorStatus(error: unknown): number {
  return error instanceof CcSwitchIntegrationError ? error.statusCode : 500
}

export async function handleCcSwitchRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  context: CcSwitchRouteContext,
): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/codex-api/cc-switch/status') {
    const status = await readCcSwitchStatus()
    const busyReason = context.appServer.getRuntimeConfigurationChangeBlockReason()
    setJson(res, 200, {
      ...status,
      switchable: status.switchable && !busyReason,
      reason: status.reason || busyReason,
    })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/codex-api/cc-switch/switch') {
    let releaseRuntimeChange: (() => void) | null = null
    try {
      const body = asRecord(await context.readJsonBody(req))
      const providerId = readString(body?.providerId)
      const expectedCurrentProviderId = readString(body?.expectedCurrentProviderId)
      const blockReason = context.appServer.getRuntimeConfigurationChangeBlockReason()
      if (blockReason) throw new CcSwitchIntegrationError('RUNTIME_BUSY', blockReason, 409)
      releaseRuntimeChange = context.appServer.beginRuntimeConfigurationChange()
      const status = await switchCcSwitchProvider(providerId, {
        reloadRuntime: () => context.appServer.reload(),
        expectedCurrentProviderId,
      })
      setJson(res, 200, status)
    } catch (error) {
      setJson(res, getErrorStatus(error), {
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof CcSwitchIntegrationError ? error.code : 'SWITCH_FAILED',
      })
    } finally {
      releaseRuntimeChange?.()
    }
    return true
  }

  return false
}
