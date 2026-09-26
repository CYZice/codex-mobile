import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

export type CcSwitchUsageRow = {
  date: string
  model: string
  requests: number
  successCount: number
  freshInputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  outputTokens: number
  totalTokens: number
  totalCostUsd: number
}

export type CcSwitchUsageModel = Omit<CcSwitchUsageRow, 'date' | 'successCount'> & {
  successRate: number
}

export type CcSwitchUsageDashboard = {
  source: 'cc-switch'
  databasePath: string
  totals: {
    requests: number
    successRate: number
    freshInputTokens: number
    cacheReadTokens: number
    cacheCreationTokens: number
    outputTokens: number
    totalTokens: number
    totalCostUsd: number
    cacheHitRate: number
    activeDays: number
    peakDailyTokens: number
    currentStreak: number
    longestStreak: number
    firstDate: string | null
    latestDate: string | null
  }
  daily: CcSwitchUsageRow[]
  models: CcSwitchUsageModel[]
}

const ccSwitchDatabasePath = () => {
  const root = process.env.CC_SWITCH_HOME?.trim() || join(homedir(), '.cc-switch')
  return join(root, 'cc-switch.db')
}

const number = (value: unknown) => Number(value) || 0

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function streaks(days: string[]): { current: number; longest: number } {
  const set = new Set(days)
  const sorted = [...set].sort()
  let longest = 0
  let run = 0
  let previous: Date | null = null
  for (const day of sorted) {
    const current = new Date(`${day}T12:00:00`)
    const consecutive = previous
      ? Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1
      : false
    run = consecutive ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = current
  }

  let current = 0
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  for (let index = 0; index < 10_000; index += 1) {
    if (!set.has(localDateKey(cursor))) break
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, longest }
}

const freshInputSql = (alias: string) => `CASE
  WHEN ${alias}.input_token_semantics = 2 THEN ${alias}.input_tokens
  WHEN ${alias}.input_token_semantics = 1
       AND ${alias}.input_tokens >= (${alias}.cache_read_tokens + ${alias}.cache_creation_tokens)
    THEN ${alias}.input_tokens - ${alias}.cache_read_tokens - ${alias}.cache_creation_tokens
  WHEN ${alias}.input_token_semantics = 0
       AND ${alias}.input_tokens >= ${alias}.cache_read_tokens
    THEN ${alias}.input_tokens - ${alias}.cache_read_tokens
  ELSE ${alias}.input_tokens
END`

const effectiveModelSql = (alias: string) => `COALESCE(NULLIF(${alias}.pricing_model, ''), ${alias}.model)`

function effectiveDetailFilter(alias: string): string {
  return `NOT (
    COALESCE(${alias}.data_source, 'proxy') IN ('session_log', 'codex_session', 'gemini_session', 'opencode_session')
    AND EXISTS (
      SELECT 1
      FROM proxy_request_logs proxy_dedup
      WHERE COALESCE(proxy_dedup.data_source, 'proxy') = 'proxy'
        AND proxy_dedup.app_type = ${alias}.app_type
        AND proxy_dedup.status_code >= 200
        AND proxy_dedup.status_code < 300
        AND proxy_dedup.input_tokens = ${alias}.input_tokens
        AND proxy_dedup.output_tokens = ${alias}.output_tokens
        AND proxy_dedup.cache_read_tokens = ${alias}.cache_read_tokens
        AND (
          proxy_dedup.cache_creation_tokens = ${alias}.cache_creation_tokens
          OR (
            ${alias}.cache_creation_tokens = 0
            AND COALESCE(${alias}.data_source, 'proxy') IN ('codex_session', 'gemini_session', 'opencode_session')
          )
        )
        AND proxy_dedup.created_at BETWEEN ${alias}.created_at - 600 AND ${alias}.created_at + 600
        AND (
          LOWER(proxy_dedup.model) = LOWER(${alias}.model)
          OR LOWER(proxy_dedup.model) = 'unknown'
          OR LOWER(${alias}.model) = 'unknown'
        )
    )
  )`
}

function queryRows(databasePath: string): CcSwitchUsageRow[] {
  const detailFresh = freshInputSql('l')
  const rollupFresh = freshInputSql('r')
  const sql = `
WITH usage_rows AS (
  SELECT
    date(l.created_at, 'unixepoch', 'localtime') AS date,
    ${effectiveModelSql('l')} AS model,
    COUNT(*) AS requests,
    SUM(CASE WHEN l.status_code >= 200 AND l.status_code < 300 THEN 1 ELSE 0 END) AS success_count,
    SUM(${detailFresh}) AS fresh_input_tokens,
    SUM(l.cache_read_tokens) AS cache_read_tokens,
    SUM(l.cache_creation_tokens) AS cache_creation_tokens,
    SUM(l.output_tokens) AS output_tokens,
    SUM(CAST(l.total_cost_usd AS REAL)) AS total_cost_usd
  FROM proxy_request_logs l
  WHERE l.app_type = 'codex'
    AND ${effectiveDetailFilter('l')}
  GROUP BY 1, 2

  UNION ALL

  SELECT
    r.date AS date,
    ${effectiveModelSql('r')} AS model,
    SUM(r.request_count) AS requests,
    SUM(r.success_count) AS success_count,
    SUM(${rollupFresh}) AS fresh_input_tokens,
    SUM(r.cache_read_tokens) AS cache_read_tokens,
    SUM(r.cache_creation_tokens) AS cache_creation_tokens,
    SUM(r.output_tokens) AS output_tokens,
    SUM(CAST(r.total_cost_usd AS REAL)) AS total_cost_usd
  FROM usage_daily_rollups r
  WHERE r.app_type = 'codex'
  GROUP BY 1, 2
)
SELECT
  date,
  model,
  SUM(requests) AS requests,
  SUM(success_count) AS success_count,
  SUM(fresh_input_tokens) AS fresh_input_tokens,
  SUM(cache_read_tokens) AS cache_read_tokens,
  SUM(cache_creation_tokens) AS cache_creation_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(total_cost_usd) AS total_cost_usd
FROM usage_rows
GROUP BY date, model
ORDER BY date, model;`

  const result = spawnSync('sqlite3', ['-json', databasePath, sql], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to query CC Switch usage database')
  }
  const parsed = result.stdout.trim() ? JSON.parse(result.stdout) as Array<Record<string, unknown>> : []
  return parsed.map((row) => {
    const freshInputTokens = number(row.fresh_input_tokens)
    const cacheReadTokens = number(row.cache_read_tokens)
    const cacheCreationTokens = number(row.cache_creation_tokens)
    const outputTokens = number(row.output_tokens)
    return {
      date: String(row.date || ''),
      model: String(row.model || 'unknown'),
      requests: number(row.requests),
      successCount: number(row.success_count),
      freshInputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      outputTokens,
      totalTokens: freshInputTokens + cacheReadTokens + cacheCreationTokens + outputTokens,
      totalCostUsd: number(row.total_cost_usd),
    }
  }).filter((row) => row.date)
}

export function readCcSwitchUsageDashboard(): CcSwitchUsageDashboard {
  const databasePath = ccSwitchDatabasePath()
  if (!existsSync(databasePath)) {
    throw new Error(`CC Switch usage database not found: ${databasePath}`)
  }

  const rows = queryRows(databasePath)
  const dailyMap = new Map<string, CcSwitchUsageRow>()
  const modelMap = new Map<string, CcSwitchUsageModel & { successCount: number }>()
  const totals = {
    requests: 0,
    successCount: 0,
    freshInputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
  }

  for (const row of rows) {
    totals.requests += row.requests
    totals.successCount += row.successCount
    totals.freshInputTokens += row.freshInputTokens
    totals.cacheReadTokens += row.cacheReadTokens
    totals.cacheCreationTokens += row.cacheCreationTokens
    totals.outputTokens += row.outputTokens
    totals.totalTokens += row.totalTokens
    totals.totalCostUsd += row.totalCostUsd

    const day = dailyMap.get(row.date) || {
      date: row.date,
      model: 'all',
      requests: 0,
      successCount: 0,
      freshInputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    }
    day.requests += row.requests
    day.successCount += row.successCount
    day.freshInputTokens += row.freshInputTokens
    day.cacheReadTokens += row.cacheReadTokens
    day.cacheCreationTokens += row.cacheCreationTokens
    day.outputTokens += row.outputTokens
    day.totalTokens += row.totalTokens
    day.totalCostUsd += row.totalCostUsd
    dailyMap.set(row.date, day)

    const model = modelMap.get(row.model) || {
      model: row.model,
      requests: 0,
      successCount: 0,
      successRate: 0,
      freshInputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    }
    model.requests += row.requests
    model.successCount += row.successCount
    model.freshInputTokens += row.freshInputTokens
    model.cacheReadTokens += row.cacheReadTokens
    model.cacheCreationTokens += row.cacheCreationTokens
    model.outputTokens += row.outputTokens
    model.totalTokens += row.totalTokens
    model.totalCostUsd += row.totalCostUsd
    modelMap.set(row.model, model)
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const dates = daily.filter((row) => row.totalTokens > 0).map((row) => row.date)
  const streak = streaks(dates)
  const cacheableInput = totals.freshInputTokens + totals.cacheCreationTokens + totals.cacheReadTokens
  const successRate = totals.requests ? totals.successCount / totals.requests : 0
  const cacheHitRate = cacheableInput ? totals.cacheReadTokens / cacheableInput : 0

  const models = [...modelMap.values()]
    .map(({ successCount, ...model }) => ({
      ...model,
      successRate: model.requests ? successCount / model.requests : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)

  return {
    source: 'cc-switch',
    databasePath,
    totals: {
      requests: totals.requests,
      successRate,
      freshInputTokens: totals.freshInputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheCreationTokens: totals.cacheCreationTokens,
      outputTokens: totals.outputTokens,
      totalTokens: totals.totalTokens,
      totalCostUsd: totals.totalCostUsd,
      cacheHitRate,
      activeDays: dates.length,
      peakDailyTokens: daily.reduce((max, row) => Math.max(max, row.totalTokens), 0),
      currentStreak: streak.current,
      longestStreak: streak.longest,
      firstDate: dates[0] ?? null,
      latestDate: dates.at(-1) ?? null,
    },
    daily,
    models,
  }
}
