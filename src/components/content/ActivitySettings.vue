<template>
  <section class="activity-page">
    <header class="activity-header">
      <div>
        <h2>{{ t('Activity') }}</h2>
        <p>{{ t('Usage statistics from CC Switch.') }}</p>
      </div>
      <button type="button" :disabled="loading" @click="load">
        {{ loading ? t('Loading…') : t('Refresh') }}
      </button>
    </header>

    <div v-if="error" class="activity-error">
      <strong>{{ t('CC Switch usage is unavailable') }}</strong>
      <p>{{ error }}</p>
    </div>

    <template v-if="data">
      <section class="summary-grid">
        <div v-for="item in summaryItems" :key="item.label" class="summary-item">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </section>

      <section class="activity-section token-breakdown">
        <div>
          <span>{{ t('Fresh input') }}</span>
          <strong>{{ compact(data.totals.freshInputTokens) }}</strong>
        </div>
        <div>
          <span>{{ t('Cache read') }}</span>
          <strong>{{ compact(data.totals.cacheReadTokens) }}</strong>
        </div>
        <div>
          <span>{{ t('Output') }}</span>
          <strong>{{ compact(data.totals.outputTokens) }}</strong>
        </div>
        <div>
          <span>{{ t('Cache creation') }}</span>
          <strong>{{ compact(data.totals.cacheCreationTokens) }}</strong>
        </div>
      </section>

      <section class="activity-section">
        <div class="section-heading">
          <div>
            <h3>{{ t('Token activity') }}</h3>
            <p>{{ t('Last 12 months') }}</p>
          </div>
          <span class="source-badge">CC Switch</span>
        </div>

        <div class="heatmap-scroll">
          <div
            class="heatmap-grid"
            :style="{
              gridTemplateColumns: `2rem repeat(${calendar.weeks}, .75rem)`,
              gridTemplateRows: '1.25rem repeat(7, .75rem)',
            }"
          >
            <span
              v-for="month in calendar.months"
              :key="month.key"
              class="month-label"
              :style="{ gridColumn: String(month.week + 2), gridRow: '1' }"
            >{{ month.label }}</span>
            <span
              v-for="(weekday, index) in weekdays"
              :key="weekday"
              class="weekday-label"
              :style="{ gridColumn: '1', gridRow: String(index + 2) }"
            >{{ weekday }}</span>
            <div
              v-for="cell in calendar.cells"
              :key="cell.date"
              class="heatmap-day"
              :class="[`level-${tokenLevel(cell.tokens)}`, { outside: !cell.inRange }]"
              :style="{ gridColumn: String(cell.week + 2), gridRow: String(cell.weekday + 2) }"
              :title="cell.inRange ? `${cell.date}: ${compact(cell.tokens)} tokens · ${cell.requests.toLocaleString()} requests` : ''"
            />
          </div>
        </div>
        <div class="heatmap-legend">
          <span>{{ t('Less') }}</span>
          <i v-for="level in [0, 1, 2, 3, 4]" :key="level" :class="`level-${level}`" />
          <span>{{ t('More') }}</span>
        </div>
      </section>

      <div class="insights-layout">
        <section class="activity-section insights-panel">
          <h3>{{ t('Activity insights') }}</h3>
          <dl class="insight-list">
            <div><dt>{{ t('Active days') }}</dt><dd>{{ data.totals.activeDays.toLocaleString() }}</dd></div>
            <div><dt>{{ t('Current streak') }}</dt><dd>{{ data.totals.currentStreak }} {{ t('days') }}</dd></div>
            <div><dt>{{ t('Longest streak') }}</dt><dd>{{ data.totals.longestStreak }} {{ t('days') }}</dd></div>
            <div><dt>{{ t('Models used') }}</dt><dd>{{ data.models.length.toLocaleString() }}</dd></div>
            <div><dt>{{ t('Success rate') }}</dt><dd>{{ percent(data.totals.successRate) }}</dd></div>
            <div><dt>{{ t('Date range') }}</dt><dd>{{ dateRange }}</dd></div>
          </dl>
        </section>

        <section class="activity-section insights-panel">
          <h3>{{ t('Top models') }}</h3>
          <div class="top-model-list">
            <div v-for="model in data.models.slice(0, 8)" :key="model.model">
              <strong>{{ model.model }}</strong>
              <span>{{ compact(model.totalTokens) }} · {{ share(model.totalTokens) }}</span>
            </div>
          </div>
        </section>
      </div>

      <section class="activity-section">
        <div class="section-heading">
          <div>
            <h3>{{ t('Model usage') }}</h3>
            <p>{{ t('Same model grouping and token semantics as CC Switch.') }}</p>
          </div>
          <strong>{{ compact(data.totals.totalTokens) }} {{ t('tokens') }}</strong>
        </div>

        <div class="model-list">
          <div v-for="model in data.models" :key="model.model" class="model-row">
            <div class="model-main">
              <div class="model-title">
                <strong>{{ model.model }}</strong>
                <span>{{ compact(model.totalTokens) }} · {{ share(model.totalTokens) }}</span>
              </div>
              <div class="model-bar"><i :style="{ width: share(model.totalTokens) }" /></div>
            </div>
            <div class="model-breakdown">
              <span><b>{{ compact(model.freshInputTokens) }}</b>{{ t('fresh input') }}</span>
              <span><b>{{ compact(model.cacheReadTokens) }}</b>{{ t('cache read') }}</span>
              <span><b>{{ percent(modelCacheHitRate(model)) }}</b>{{ t('cache hit') }}</span>
              <span><b>{{ compact(model.outputTokens) }}</b>{{ t('output') }}</span>
              <span><b>{{ model.requests.toLocaleString() }}</b>{{ t('requests') }}</span>
              <span><b>{{ money(model.totalCostUsd) }}</b>{{ t('cost') }}</span>
            </div>
          </div>
        </div>
      </section>

      <details class="activity-section advanced-panel">
        <summary>{{ t('Runtime diagnostics') }}</summary>
        <div v-if="runtime" class="runtime-panel">
          <div class="runtime-counters">
            <span>{{ t('Pending RPC') }} <b>{{ runtime.appServer.pendingRpcCount }}</b></span>
            <span>{{ t('Active turns') }} <b>{{ runtime.appServer.activeTurnCount }}</b></span>
            <span>{{ t('Server requests') }} <b>{{ runtime.appServer.pendingServerRequestCount }}</b></span>
            <span>{{ t('WebSocket clients') }} <b>{{ runtime.websocket.activeSubscribers }}</b></span>
          </div>
          <code>{{ data.databasePath }}</code>
        </div>
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCcSwitchUsage, getRuntimeDiagnostics, type CcSwitchUsageDashboard, type RuntimeDiagnosticsSnapshot } from '../../api/codexGateway'
import { useUiLanguage } from '../../composables/useUiLanguage'

const { t } = useUiLanguage()
const data = ref<CcSwitchUsageDashboard | null>(null)
const runtime = ref<RuntimeDiagnosticsSnapshot | null>(null)
const loading = ref(false)
const error = ref('')
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function compact(value: number) {
  const absolute = Math.abs(value)
  const format = (divisor: number, suffix: string) => `${(value / divisor).toFixed(1).replace(/\.0$/u, '')}${suffix}`
  if (absolute >= 1_000_000_000) return format(1_000_000_000, 'B')
  if (absolute >= 1_000_000) return format(1_000_000, 'M')
  if (absolute >= 1_000) return format(1_000, 'K')
  return value.toLocaleString()
}

const money = (value: number) => `$${value.toFixed(value >= 100 ? 2 : 4)}`
const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const share = (tokens: number) => data.value?.totals.totalTokens ? `${((tokens / data.value.totals.totalTokens) * 100).toFixed(1)}%` : '0%'
const modelCacheHitRate = (model: CcSwitchUsageDashboard['models'][number]) => {
  const cacheableInput = model.freshInputTokens + model.cacheCreationTokens + model.cacheReadTokens
  return cacheableInput ? model.cacheReadTokens / cacheableInput : 0
}

const summaryItems = computed(() => data.value ? [
  { label: t('Lifetime tokens'), value: compact(data.value.totals.totalTokens) },
  { label: t('Peak tokens'), value: compact(data.value.totals.peakDailyTokens) },
  { label: t('Total requests'), value: data.value.totals.requests.toLocaleString() },
  { label: t('Cache hit rate'), value: percent(data.value.totals.cacheHitRate) },
  { label: t('Total cost'), value: money(data.value.totals.totalCostUsd) },
] : [])

const dateRange = computed(() => {
  if (!data.value?.totals.firstDate || !data.value?.totals.latestDate) return '—'
  return `${data.value.totals.firstDate} → ${data.value.totals.latestDate}`
})

const calendar = computed(() => {
  const byDate = new Map(data.value?.daily.map((day) => [day.date, day]) ?? [])
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  const gridStart = new Date(start)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())
  const gridEnd = new Date(today)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()))
  const cells: Array<{ date: string; week: number; weekday: number; tokens: number; requests: number; inRange: boolean }> = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const week = Math.floor((cursor.getTime() - gridStart.getTime()) / (7 * 86_400_000))
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const row = byDate.get(key)
    const inRange = cursor >= start && cursor <= today
    cells.push({ date: key, week, weekday: cursor.getDay(), tokens: inRange ? row?.totalTokens ?? 0 : 0, requests: inRange ? row?.requests ?? 0 : 0, inRange })
    cursor.setDate(cursor.getDate() + 1)
  }
  const weeks = Math.floor((gridEnd.getTime() - gridStart.getTime()) / (7 * 86_400_000)) + 1
  const months: Array<{ key: string; label: string; week: number }> = []
  const monthCursor = new Date(start.getFullYear(), start.getMonth(), 1, 12)
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12)
  while (monthCursor <= lastMonth) {
    const visibleDate = monthCursor < start ? start : monthCursor
    months.push({
      key: `${monthCursor.getFullYear()}-${monthCursor.getMonth()}`,
      label: monthCursor.toLocaleDateString(undefined, { month: 'short' }),
      week: Math.max(0, Math.floor((visibleDate.getTime() - gridStart.getTime()) / (7 * 86_400_000))),
    })
    monthCursor.setMonth(monthCursor.getMonth() + 1)
  }
  return { cells, weeks, months }
})

const thresholds = computed(() => {
  const values = calendar.value.cells.filter((cell) => cell.inRange && cell.tokens > 0).map((cell) => cell.tokens).sort((a, b) => a - b)
  if (!values.length) return [0, 0, 0]
  const pick = (q: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))]
  return [pick(.25), pick(.5), pick(.75)]
})

function tokenLevel(tokens: number) {
  if (!tokens) return 0
  const [q1, q2, q3] = thresholds.value
  if (tokens <= q1) return 1
  if (tokens <= q2) return 2
  if (tokens <= q3) return 3
  return 4
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [usage, diagnostics] = await Promise.allSettled([getCcSwitchUsage(), getRuntimeDiagnostics()])
    if (usage.status === 'rejected') throw usage.reason
    data.value = usage.value
    runtime.value = diagnostics.status === 'fulfilled' ? diagnostics.value : null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
@reference "tailwindcss";
.activity-page{@apply mx-auto w-full max-w-6xl pb-12}.activity-header{@apply mb-7 flex items-start justify-between gap-4}.activity-header h2{@apply text-2xl font-semibold}.activity-header p,.section-heading p{@apply mt-1 text-sm text-zinc-500}.activity-header button{@apply rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50}.summary-grid{@apply grid grid-cols-5 border-y border-zinc-200}.summary-item{@apply flex flex-col items-center gap-1 px-3 py-5 text-center}.summary-item strong{@apply text-2xl font-semibold}.summary-item span{@apply text-sm text-zinc-500}.activity-section{@apply mt-9}.token-breakdown{@apply grid grid-cols-4 gap-4}.token-breakdown>div{@apply rounded-xl border border-zinc-200 p-4}.token-breakdown span{@apply block text-xs text-zinc-500}.token-breakdown strong{@apply mt-1 block text-xl}.section-heading{@apply flex items-start justify-between gap-4}.activity-section h3{@apply text-lg font-semibold}.source-badge{@apply rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500}.heatmap-scroll{@apply mt-5 overflow-x-auto pb-2}.heatmap-grid{display:grid;gap:4px;align-items:center;width:max-content;min-width:100%}.month-label{@apply text-xs text-zinc-500;align-self:end;white-space:nowrap}.weekday-label{@apply text-[11px] text-zinc-500;justify-self:end;padding-right:3px}.heatmap-day,.heatmap-legend i{@apply box-border block rounded-[2px] border border-zinc-300}.heatmap-day{width:.75rem;height:.75rem}.heatmap-day.outside{visibility:hidden}.level-0{@apply bg-transparent}.level-1{@apply bg-amber-100}.level-2{@apply bg-amber-200}.level-3{@apply bg-amber-300}.level-4{@apply bg-amber-400}.heatmap-legend{@apply mt-3 flex items-center gap-2 text-xs text-zinc-500}.heatmap-legend i{width:.75rem;height:.75rem}.insights-layout{@apply grid grid-cols-2 gap-10}.insights-panel{@apply min-w-0}.insight-list{@apply mt-5 space-y-2}.insight-list div,.top-model-list div{@apply flex items-baseline justify-between gap-5}.insight-list dt{@apply text-sm text-zinc-500}.insight-list dd{@apply text-sm font-medium}.top-model-list{@apply mt-5 space-y-2}.top-model-list strong{@apply text-sm font-medium}.top-model-list span{@apply shrink-0 text-sm text-zinc-500}.model-list{@apply mt-5 divide-y divide-zinc-200 border-y border-zinc-200}.model-row{@apply grid grid-cols-[minmax(15rem,1.2fr)_minmax(22rem,1fr)] gap-8 py-4}.model-main{@apply min-w-0}.model-title{@apply flex items-baseline justify-between gap-4}.model-title strong{@apply truncate text-sm font-medium}.model-title span{@apply shrink-0 text-xs text-zinc-500}.model-bar{@apply mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100}.model-bar i{@apply block h-full rounded-full bg-zinc-700}.model-breakdown{@apply grid grid-cols-6 gap-3}.model-breakdown span{@apply flex flex-col text-[11px] text-zinc-500}.model-breakdown b{@apply text-sm font-medium text-zinc-900}.advanced-panel{@apply border-y border-zinc-200 py-4}.advanced-panel summary{@apply cursor-pointer text-sm font-medium}.runtime-panel{@apply mt-4}.runtime-counters{@apply grid grid-cols-4 gap-3 text-sm text-zinc-500}.runtime-counters span{@apply flex flex-col gap-1}.runtime-counters b{@apply text-lg text-zinc-900}.runtime-panel code{@apply mt-4 block break-all text-xs text-zinc-500}.activity-error{@apply rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800}.activity-error p{@apply mt-1 text-sm}
@media(max-width:900px){.summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.token-breakdown{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-layout{grid-template-columns:1fr}.model-row{grid-template-columns:1fr}}
@media(max-width:640px){.activity-header{flex-direction:column}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-item{align-items:flex-start;text-align:left}.model-breakdown{grid-template-columns:repeat(2,minmax(0,1fr))}.runtime-counters{grid-template-columns:repeat(2,minmax(0,1fr))}}
:global(:root.dark) .activity-header button{border-color:#3f3f46;background:#18181b;color:#f4f4f5}:global(:root.dark) .source-badge{background:#27272a;color:#a1a1aa}:global(:root.dark) .heatmap-day,:global(:root.dark) .heatmap-legend i{border-color:#52525b}:global(:root.dark) .level-1{background:#78350f}:global(:root.dark) .level-2{background:#92400e}:global(:root.dark) .level-3{background:#b45309}:global(:root.dark) .level-4{background:#f59e0b}:global(:root.dark) .model-list{border-color:#3f3f46}:global(:root.dark) .model-row{border-color:#3f3f46}:global(:root.dark) .model-bar{background:#27272a}:global(:root.dark) .model-bar i{background:#d4d4d8}:global(:root.dark) .model-breakdown b,:global(:root.dark) .runtime-counters b{color:#f4f4f5}
</style>
