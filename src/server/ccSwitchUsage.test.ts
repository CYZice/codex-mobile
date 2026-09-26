import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { readCcSwitchUsageDashboard } from './ccSwitchUsage.js'

const hasSqlite = spawnSync('sqlite3', ['-version'], { encoding: 'utf8' }).status === 0

describe.skipIf(!hasSqlite).sequential('CC Switch usage dashboard', () => {
  const previousHome = process.env.CC_SWITCH_HOME
  let root = ''

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    if (previousHome === undefined) delete process.env.CC_SWITCH_HOME
    else process.env.CC_SWITCH_HOME = previousHome
  })

  it('matches CC Switch token semantics, merges rollups, and ignores duplicated session imports', () => {
    root = mkdtempSync(join(tmpdir(), 'cc-switch-usage-'))
    process.env.CC_SWITCH_HOME = root
    mkdirSync(root, { recursive: true })
    const db = join(root, 'cc-switch.db')
    const sql = `
      CREATE TABLE proxy_request_logs (
        request_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, app_type TEXT NOT NULL, model TEXT NOT NULL,
        request_model TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd TEXT NOT NULL DEFAULT '0', status_code INTEGER NOT NULL, created_at INTEGER NOT NULL,
        data_source TEXT NOT NULL DEFAULT 'proxy', pricing_model TEXT, input_token_semantics INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE usage_daily_rollups (
        date TEXT NOT NULL, app_type TEXT NOT NULL, provider_id TEXT NOT NULL, model TEXT NOT NULL,
        request_model TEXT NOT NULL DEFAULT '', pricing_model TEXT NOT NULL DEFAULT '', request_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0, total_cost_usd TEXT NOT NULL DEFAULT '0',
        input_token_semantics INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, app_type, provider_id, model, request_model, pricing_model)
      );

      INSERT INTO usage_daily_rollups VALUES
        ('2026-09-24','codex','_codex_session','model-a','model-a','',2,2,1000,100,800,0,'1.5',2);

      INSERT INTO proxy_request_logs VALUES
        ('proxy-1','provider','codex','model-b','alias-b',500,50,400,0,'2.0',200,1790416800,'proxy','model-b',1);
      INSERT INTO proxy_request_logs VALUES
        ('session-dup','_codex_session','codex','model-b','model-b',500,50,400,0,'2.0',200,1790416805,'codex_session','',1);
      INSERT INTO proxy_request_logs VALUES
        ('session-only','_codex_session','codex','model-c','model-c',300,30,250,0,'0.5',200,1790503200,'codex_session','',1);
    `
    const result = spawnSync('sqlite3', [db, sql], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr)

    const usage = readCcSwitchUsageDashboard()
    // rollup model-a: fresh 1000 + cache 800 + output 100 = 1900 (input semantics already fresh)
    // proxy model-b: fresh 100 + cache 400 + output 50 = 550
    // duplicated codex_session row is filtered
    // session model-c: fresh 50 + cache 250 + output 30 = 330
    expect(usage.totals.totalTokens).toBe(2780)
    expect(usage.totals.requests).toBe(4)
    expect(usage.models.find((row) => row.model === 'model-a')?.totalTokens).toBe(1900)
    expect(usage.models.find((row) => row.model === 'model-b')?.totalTokens).toBe(550)
    expect(usage.models.find((row) => row.model === 'model-c')?.totalTokens).toBe(330)
    expect(usage.models.reduce((sum, row) => sum + row.totalTokens, 0)).toBe(usage.totals.totalTokens)
    expect(usage.daily.reduce((sum, row) => sum + row.totalTokens, 0)).toBe(usage.totals.totalTokens)
  })
})
