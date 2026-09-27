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

        <div ref="heatmapScroll" class="heatmap-scroll">
          <div
            class="heatmap-grid"
            :style="{
              '--heatmap-weeks': String(calendar.weeks),
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
              :data-week="cell.week"
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

      <section class="activity-section insights-panel">
        <h3>{{ t('Activity insights') }}</h3>
        <dl class="insight-list insight-list--grid">
          <div><dt>{{ t('Active days') }}</dt><dd>{{ data.totals.activeDays.toLocaleString() }}</dd></div>
          <div><dt>{{ t('Current streak') }}</dt><dd>{{ data.totals.currentStreak }} {{ t('days') }}</dd></div>
          <div><dt>{{ t('Longest streak') }}</dt><dd>{{ data.totals.longestStreak }} {{ t('days') }}</dd></div>
          <div><dt>{{ t('Models used') }}</dt><dd>{{ data.models.length.toLocaleString() }}</dd></div>
          <div><dt>{{ t('Success rate') }}</dt><dd>{{ percent(data.totals.successRate) }}</dd></div>
          <div><dt>{{ t('Date range') }}</dt><dd>{{ dateRange }}</dd></div>
        </dl>
      </section>

      <section class="activity-section">
        <div class="section-heading">
          <div>
            <h3>{{ t('Model distribution') }}</h3>
            <p>{{ t('Top 5 models by token usage; remaining models are grouped into Others.') }}</p>
          </div>
        </div>

        <div class="distribution-panels">
          <article v-for="panel in distributionPanels" :key="panel.id" class="distribution-card">
            <div class="distribution-card-heading">
              <div>
                <h4>{{ panel.title }}</h4>
                <p>{{ panel.subtitle }}</p>
              </div>
              <strong>{{ compact(panel.totalTokens) }}</strong>
            </div>

            <div class="distribution-bar" role="group" :aria-label="panel.title">
              <button
                v-for="(model, index) in panel.items"
                :key="model.key"
                type="button"
                class="distribution-segment"
                :class="[`distribution-segment--${index + 1}`, { selected: selectedDistribution(panel)?.key === model.key }]"
                :style="{ width: modelShare(model.totalTokens, panel.totalTokens) }"
                :title="`${model.label}: ${compact(model.totalTokens)} · ${modelShare(model.totalTokens, panel.totalTokens)}`"
                @click="selectDistribution(panel.id, model.key)"
              >
                <span class="sr-only">{{ model.label }}</span>
              </button>
            </div>

            <div class="distribution-legend">
              <button
                v-for="(model, index) in panel.items"
                :key="model.key"
                type="button"
                :class="{ selected: selectedDistribution(panel)?.key === model.key }"
                @click="selectDistribution(panel.id, model.key)"
              >
                <i :class="`distribution-dot--${index + 1}`" />
                <span>{{ model.label }}</span>
                <b>{{ modelShare(model.totalTokens, panel.totalTokens) }}</b>
                <small>{{ compact(model.totalTokens) }}</small>
              </button>
            </div>

            <div v-if="selectedDistribution(panel)" class="distribution-details">
              <div class="distribution-details-heading">
                <div>
                  <strong>{{ selectedDistribution(panel)?.label }}</strong>
                  <span>
                    {{ compact(selectedDistribution(panel)?.totalTokens ?? 0) }} ·
                    {{ modelShare(selectedDistribution(panel)?.totalTokens ?? 0, panel.totalTokens) }}
                  </span>
                </div>
                <small v-if="selectedDistribution(panel)?.key === 'others'">
                  {{ selectedDistribution(panel)?.members.length }} {{ t('models grouped') }}
                </small>
              </div>
              <div class="distribution-metrics">
                <span><b>{{ compact(selectedDistribution(panel)?.freshInputTokens ?? 0) }}</b>{{ t('fresh input') }}</span>
                <span><b>{{ compact(selectedDistribution(panel)?.cacheReadTokens ?? 0) }}</b>{{ t('cache read') }}</span>
                <span><b>{{ percent(modelCacheHitRate(selectedDistribution(panel))) }}</b>{{ t('cache hit') }}</span>
                <span><b>{{ compact(selectedDistribution(panel)?.outputTokens ?? 0) }}</b>{{ t('output') }}</span>
                <span><b>{{ (selectedDistribution(panel)?.requests ?? 0).toLocaleString() }}</b>{{ t('requests') }}</span>
                <span><b>{{ money(selectedDistribution(panel)?.totalCostUsd ?? 0) }}</b>{{ t('cost') }}</span>
              </div>
              <p v-if="selectedDistribution(panel)?.key === 'others'" class="distribution-members">
                {{ selectedDistribution(panel)?.members.join(' · ') }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="memoryIndex || memoryError" class="activity-section memory-preview">
        <div class="section-heading">
          <div>
            <h3>{{ t('Memory preview') }}</h3>
            <p v-if="memoryIndex">
              {{ memoryIndex.topics.length }} {{ t('topics') }} · {{ memoryUpdatedAt }}
            </p>
            <p v-else>{{ t('Memory preview is unavailable.') }}</p>
          </div>
          <span v-if="memoryIndex" class="source-badge">{{ t('Read only') }}</span>
        </div>

        <p v-if="memoryError" class="memory-error">{{ memoryError }}</p>
        <template v-if="memoryIndex">
          <div v-if="memoryIndex.topics.length" class="memory-topic-strip">
            <button
              v-for="topic in memoryIndex.topics"
              :key="topic.id"
              type="button"
              :class="{ selected: selectedTopic?.id === topic.id }"
              @click="selectTopic(topic)"
            >{{ topic.title }}</button>
          </div>

          <article v-if="selectedTopic" class="memory-topic-card">
            <div class="memory-topic-heading">
              <div>
                <h4>{{ selectedTopic.title }}</h4>
                <small>{{ memorySourceName(selectedTopic.sourceFile) }}:{{ selectedTopic.line }}</small>
              </div>
              <button type="button" class="memory-source-button" @click="toggleMemorySource">
                {{ source?.path === selectedTopic.sourceFile ? t('Hide source') : t('View source') }}
              </button>
            </div>
            <p>{{ selectedTopic.summary || t('No summary available.') }}</p>
            <div v-if="selectedTopic.keywords.length" class="memory-keywords">
              <span v-for="keyword in selectedTopic.keywords.slice(0, 8)" :key="keyword">{{ keyword }}</span>
            </div>
            <pre v-if="source?.path === selectedTopic.sourceFile">{{ source.content }}</pre>
          </article>

          <p v-else class="memory-empty">{{ t('No memory topics found.') }}</p>
        </template>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getCcSwitchUsage,
  getMemoryFile,
  getMemoryIndex,
  getRuntimeDiagnostics,
  type CcSwitchUsageDashboard,
  type MemoryIndex,
  type RuntimeDiagnosticsSnapshot,
} from '../../api/codexGateway'
import { useUiLanguage } from '../../composables/useUiLanguage'

const { t } = useUiLanguage()
const data = ref<CcSwitchUsageDashboard | null>(null)
const runtime = ref<RuntimeDiagnosticsSnapshot | null>(null)
const memoryIndex = ref<MemoryIndex | null>(null)
const selectedTopic = ref<MemoryIndex['topics'][number] | null>(null)
const source = ref<{ path: string; content: string } | null>(null)
const memoryError = ref('')
const selectedModelKeys = ref<Record<'recent' | 'all', string>>({ recent: '', all: '' })
const loading = ref(false)
const error = ref('')
const heatmapScroll = ref<HTMLElement | null>(null)
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type ModelDistributionItem = CcSwitchUsageDashboard['models'][number] & {
  key: string
  label: string
  members: string[]
}

type DistributionPanel = {
  id: 'recent' | 'all'
  title: string
  subtitle: string
  totalTokens: number
  items: ModelDistributionItem[]
}

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
const modelShare = (tokens: number, totalTokens: number) => totalTokens ? `${((tokens / totalTokens) * 100).toFixed(1)}%` : '0%'
const modelCacheHitRate = (model: CcSwitchUsageDashboard['models'][number] | null | undefined) => {
  if (!model) return 0
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

function buildModelDistribution(models: CcSwitchUsageDashboard['models']): ModelDistributionItem[] {
  const top = models.slice(0, 5).map((model) => ({
    ...model,
    key: model.model,
    label: model.model,
    members: [model.model],
  }))
  const rest = models.slice(5)
  if (!rest.length) return top

  const requests = rest.reduce((sum, model) => sum + model.requests, 0)
  const successes = rest.reduce((sum, model) => sum + model.successRate * model.requests, 0)
  top.push({
    key: 'others',
    label: t('Others'),
    members: rest.map((model) => model.model),
    model: 'others',
    requests,
    successRate: requests ? successes / requests : 0,
    freshInputTokens: rest.reduce((sum, model) => sum + model.freshInputTokens, 0),
    cacheReadTokens: rest.reduce((sum, model) => sum + model.cacheReadTokens, 0),
    cacheCreationTokens: rest.reduce((sum, model) => sum + model.cacheCreationTokens, 0),
    outputTokens: rest.reduce((sum, model) => sum + model.outputTokens, 0),
    totalTokens: rest.reduce((sum, model) => sum + model.totalTokens, 0),
    totalCostUsd: rest.reduce((sum, model) => sum + model.totalCostUsd, 0),
  })
  return top
}

const distributionPanels = computed<DistributionPanel[]>(() => {
  const recentModels = data.value?.modelsLast30Days ?? []
  const allModels = data.value?.models ?? []
  return [
    {
      id: 'recent',
      title: t('Last 30 days'),
      subtitle: t('Recent model usage from CC Switch'),
      totalTokens: recentModels.reduce((sum, model) => sum + model.totalTokens, 0),
      items: buildModelDistribution(recentModels),
    },
    {
      id: 'all',
      title: t('All time'),
      subtitle: t('Full model usage history from CC Switch'),
      totalTokens: allModels.reduce((sum, model) => sum + model.totalTokens, 0),
      items: buildModelDistribution(allModels),
    },
  ]
})

function selectedDistribution(panel: DistributionPanel): ModelDistributionItem | null {
  return panel.items.find((model) => model.key === selectedModelKeys.value[panel.id]) ?? panel.items[0] ?? null
}

function selectDistribution(panelId: DistributionPanel['id'], modelKey: string) {
  selectedModelKeys.value[panelId] = modelKey
}

const memoryUpdatedAt = computed(() => {
  const values = memoryIndex.value?.files.map((file) => new Date(file.updatedAt).getTime()).filter(Number.isFinite) ?? []
  if (!values.length) return t('No source files')
  return new Date(Math.max(...values)).toLocaleString()
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

function scrollHeatmapToActivity() {
  const container = heatmapScroll.value
  if (!container) return
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
  if (maxScroll <= 1) {
    container.scrollLeft = 0
    return
  }

  const activeCells = calendar.value.cells.filter((cell) => cell.inRange && cell.tokens > 0)
  const targetWeek = activeCells.at(-1)?.week ?? Math.max(0, calendar.value.weeks - 1)
  const target = container.querySelector<HTMLElement>(`.heatmap-day[data-week="${targetWeek}"]`)
  if (!target) return

  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetOffset = targetRect.left - containerRect.left + container.scrollLeft
  // Keep the latest active week toward the right side so preceding active weeks
  // remain visible while later empty weeks do not dominate the first viewport.
  const desired = targetOffset - container.clientWidth * 0.72
  container.scrollLeft = Math.max(0, Math.min(maxScroll, desired))
}

function syncHeatmapViewport() {
  void nextTick().then(scrollHeatmapToActivity)
}

function memorySourceName(path: string) {
  return path.split(/[\\/]/u).at(-1) || path
}

function selectTopic(topic: MemoryIndex['topics'][number]) {
  selectedTopic.value = topic
  source.value = null
  memoryError.value = ''
}

async function toggleMemorySource() {
  if (!selectedTopic.value) return
  if (source.value?.path === selectedTopic.value.sourceFile) {
    source.value = null
    return
  }
  memoryError.value = ''
  try {
    source.value = await getMemoryFile(selectedTopic.value.sourceFile)
  } catch (cause) {
    memoryError.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  memoryError.value = ''
  try {
    const [usage, diagnostics, memory] = await Promise.allSettled([
      getCcSwitchUsage(),
      getRuntimeDiagnostics(),
      getMemoryIndex(),
    ])
    runtime.value = diagnostics.status === 'fulfilled' ? diagnostics.value : null
    if (memory.status === 'fulfilled') {
      memoryIndex.value = memory.value
      if (!selectedTopic.value || !memory.value.topics.some((topic) => topic.id === selectedTopic.value?.id)) {
        selectedTopic.value = memory.value.topics[0] ?? null
        source.value = null
      }
    } else {
      memoryIndex.value = null
      selectedTopic.value = null
      source.value = null
      memoryError.value = memory.reason instanceof Error ? memory.reason.message : String(memory.reason)
    }
    if (usage.status === 'rejected') throw usage.reason
    data.value = usage.value
    for (const panel of distributionPanels.value) {
      if (!selectedModelKeys.value[panel.id] || !panel.items.some((model) => model.key === selectedModelKeys.value[panel.id])) {
        selectedModelKeys.value[panel.id] = panel.items[0]?.key ?? ''
      }
    }
    syncHeatmapViewport()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', syncHeatmapViewport)
  void load()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncHeatmapViewport)
})
</script>

<style scoped>
@reference "tailwindcss";
.activity-page{@apply mx-auto w-full max-w-6xl pb-12}
.activity-header{@apply mb-7 flex items-start justify-between gap-4}
.activity-header h2{@apply text-2xl font-semibold}
.activity-header p,.section-heading p{@apply mt-1 text-sm text-zinc-500}
.activity-header button,.memory-source-button{@apply rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50}
.summary-grid{@apply grid grid-cols-5 border-y border-zinc-200}
.summary-item{@apply flex flex-col items-center gap-1 px-3 py-5 text-center}
.summary-item strong{@apply text-2xl font-semibold}
.summary-item span{@apply text-sm text-zinc-500}
.activity-section{@apply mt-9}
.token-breakdown{@apply grid grid-cols-4 gap-4}
.token-breakdown>div{@apply rounded-xl border border-zinc-200 p-4}
.token-breakdown span{@apply block text-xs text-zinc-500}
.token-breakdown strong{@apply mt-1 block text-xl}
.section-heading{@apply flex items-start justify-between gap-4}
.activity-section h3{@apply text-lg font-semibold}
.source-badge{@apply rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500}
.heatmap-scroll{@apply mt-5 overflow-hidden}
.heatmap-grid{display:grid;grid-template-columns:2rem repeat(var(--heatmap-weeks),minmax(0,1fr));gap:4px;align-items:center;width:100%;min-width:0}
.month-label{@apply text-xs text-zinc-500;align-self:end;white-space:nowrap}
.weekday-label{@apply text-[11px] text-zinc-500;justify-self:end;padding-right:3px}
.heatmap-day,.heatmap-legend i{@apply box-border block rounded-[2px] border border-zinc-300}
.heatmap-day{width:100%;aspect-ratio:1;height:auto}
.heatmap-day.outside{visibility:hidden}
.level-0{@apply bg-transparent}.level-1{@apply bg-amber-100}.level-2{@apply bg-amber-200}.level-3{@apply bg-amber-300}.level-4{@apply bg-amber-400}
.heatmap-legend{@apply mt-3 flex items-center gap-2 text-xs text-zinc-500}
.heatmap-legend i{width:.75rem;height:.75rem}
.insights-panel{@apply min-w-0}
.insight-list--grid{@apply mt-5 grid grid-cols-3 gap-x-8 gap-y-4}
.insight-list--grid div{@apply flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-2}
.insight-list dt{@apply text-sm text-zinc-500}
.insight-list dd{@apply text-sm font-medium}
.distribution-panels{@apply mt-5 grid grid-cols-2 gap-4}
.distribution-card{@apply rounded-xl border border-zinc-200 p-4}
.distribution-card-heading{@apply mb-4 flex items-start justify-between gap-4}
.distribution-card-heading h4{@apply text-base font-semibold}
.distribution-card-heading p{@apply mt-1 text-xs text-zinc-500}
.distribution-card-heading>strong{@apply shrink-0 text-sm font-semibold}
.distribution-bar{@apply flex h-9 w-full overflow-hidden rounded-lg bg-zinc-100}
.distribution-segment{@apply relative h-full min-w-[2px] transition-[filter,opacity] hover:brightness-110}
.distribution-segment.selected{@apply ring-2 ring-inset ring-white/80}
.distribution-segment--1,.distribution-dot--1{background:#18181b}
.distribution-segment--2,.distribution-dot--2{background:#52525b}
.distribution-segment--3,.distribution-dot--3{background:#a16207}
.distribution-segment--4,.distribution-dot--4{background:#d97706}
.distribution-segment--5,.distribution-dot--5{background:#f59e0b}
.distribution-segment--6,.distribution-dot--6{background:#d4d4d8}
.distribution-legend{@apply mt-4 grid grid-cols-3 gap-2}
.distribution-legend button{@apply grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left hover:bg-zinc-50}
.distribution-legend button.selected{@apply border-zinc-200 bg-zinc-50}
.distribution-legend i{@apply block h-2.5 w-2.5 rounded-sm}
.distribution-legend span{@apply truncate text-sm font-medium}
.distribution-legend b{@apply text-xs font-medium}
.distribution-legend small{@apply text-xs text-zinc-500}
.distribution-details{@apply mt-4 border-t border-zinc-100 pt-4}
.distribution-details-heading{@apply flex items-start justify-between gap-4}
.distribution-details-heading>div{@apply flex items-baseline gap-2}
.distribution-details-heading strong{@apply text-sm font-semibold}
.distribution-details-heading span,.distribution-details-heading small{@apply text-xs text-zinc-500}
.distribution-metrics{@apply mt-3 grid grid-cols-6 gap-3}
.distribution-metrics span{@apply flex flex-col text-[11px] text-zinc-500}
.distribution-metrics b{@apply text-sm font-medium text-zinc-900}
.distribution-members{@apply mt-3 line-clamp-2 text-xs leading-5 text-zinc-500}
.memory-preview{@apply rounded-xl border border-zinc-200 p-4}
.memory-topic-strip{@apply mt-4 flex gap-2 overflow-x-auto pb-2}
.memory-topic-strip button{@apply shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100}
.memory-topic-strip button.selected{@apply border-zinc-900 bg-zinc-900 text-white}
.memory-topic-card{@apply mt-3 rounded-xl bg-zinc-50 p-4}
.memory-topic-heading{@apply flex items-start justify-between gap-4}
.memory-topic-heading h4{@apply text-base font-semibold}
.memory-topic-heading small{@apply mt-1 block text-xs text-zinc-500}
.memory-topic-card>p{@apply mt-3 text-sm leading-6 text-zinc-700}
.memory-keywords{@apply mt-3 flex flex-wrap gap-1.5}
.memory-keywords span{@apply rounded bg-zinc-200/70 px-2 py-1 text-[11px] text-zinc-600}
.memory-topic-card pre{@apply mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100}
.memory-error{@apply mt-3 text-sm text-red-700}
.memory-empty{@apply mt-4 text-sm text-zinc-500}
.advanced-panel{@apply border-y border-zinc-200 py-4}
.advanced-panel summary{@apply cursor-pointer text-sm font-medium}
.runtime-panel{@apply mt-4}
.runtime-counters{@apply grid grid-cols-4 gap-3 text-sm text-zinc-500}
.runtime-counters span{@apply flex flex-col gap-1}
.runtime-counters b{@apply text-lg text-zinc-900}
.runtime-panel code{@apply mt-4 block break-all text-xs text-zinc-500}
.activity-error{@apply rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800}
.activity-error p{@apply mt-1 text-sm}
@media(max-width:900px){
  .heatmap-scroll{@apply overflow-x-auto pb-2}
  .heatmap-grid{grid-template-columns:2rem repeat(var(--heatmap-weeks),.75rem);width:max-content;min-width:100%;column-gap:4px}
  .heatmap-day{width:.75rem;height:.75rem;aspect-ratio:auto}
  .summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .token-breakdown{grid-template-columns:repeat(2,minmax(0,1fr))}
  .insight-list--grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .distribution-legend{grid-template-columns:repeat(2,minmax(0,1fr))}
  .distribution-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
  .distribution-panels{grid-template-columns:1fr}
}
@media(max-width:640px){
  .activity-header{flex-direction:column}
  .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .summary-item{align-items:flex-start;text-align:left}
  .insight-list--grid{grid-template-columns:1fr}
  .distribution-legend{grid-template-columns:1fr}
  .distribution-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
  .memory-topic-heading{flex-direction:column}
  .runtime-counters{grid-template-columns:repeat(2,minmax(0,1fr))}
}
:global(:root.dark) .activity-header button,:global(:root.dark) .memory-source-button{border-color:#3f3f46;background:#18181b;color:#f4f4f5}
:global(:root.dark) .source-badge{background:#27272a;color:#a1a1aa}
:global(:root.dark) .heatmap-day,:global(:root.dark) .heatmap-legend i{border-color:#52525b}
:global(:root.dark) .level-1{background:#78350f}:global(:root.dark) .level-2{background:#92400e}:global(:root.dark) .level-3{background:#b45309}:global(:root.dark) .level-4{background:#f59e0b}
:global(:root.dark) .insight-list--grid div,:global(:root.dark) .distribution-details{border-color:#27272a}
:global(:root.dark) .distribution-card,:global(:root.dark) .memory-preview{border-color:#3f3f46}
:global(:root.dark) .distribution-bar{background:#27272a}
:global(:root.dark) .distribution-legend button:hover,:global(:root.dark) .distribution-legend button.selected{background:#27272a;border-color:#3f3f46}
:global(:root.dark) .distribution-metrics b,:global(:root.dark) .runtime-counters b{color:#f4f4f5}
:global(:root.dark) .memory-topic-strip button{border-color:#3f3f46;color:#d4d4d8}
:global(:root.dark) .memory-topic-strip button:hover{background:#27272a}
:global(:root.dark) .memory-topic-strip button.selected{border-color:#f4f4f5;background:#f4f4f5;color:#18181b}
:global(:root.dark) .memory-topic-card{background:#18181b}
:global(:root.dark) .memory-topic-card>p{color:#d4d4d8}
:global(:root.dark) .memory-keywords span{background:#27272a;color:#a1a1aa}
</style>
