<template>
  <aside class="thread-summary-panel" aria-label="Thread summary">
    <header class="thread-summary-header">
      <span class="thread-summary-title">摘要</span>
      <button class="thread-summary-close" type="button" aria-label="隐藏摘要" title="隐藏摘要" @click="$emit('close')">
        <IconTablerX aria-hidden="true" />
      </button>
    </header>
    <section v-for="section in sections" :key="section.id" class="thread-summary-section">
      <button class="thread-summary-section-toggle" type="button" :aria-expanded="!collapsed[section.id]" @click="toggle(section.id)">
        <span class="thread-summary-section-title">{{ section.title }}</span>
        <IconTablerChevronDown class="thread-summary-chevron" :class="{ 'is-expanded': !collapsed[section.id] }" aria-hidden="true" />
      </button>
      <div v-if="!collapsed[section.id]" class="thread-summary-section-body">
        <div v-for="row in section.rows" :key="row.label" class="thread-summary-row">
          <span class="thread-summary-row-label">{{ row.label }}</span>
          <span class="thread-summary-row-value" :class="{ 'is-muted': row.muted }" :title="row.value">{{ row.value }}</span>
        </div>
        <p v-if="section.rows.length === 0" class="thread-summary-empty">{{ section.emptyLabel }}</p>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import IconTablerChevronDown from '../icons/IconTablerChevronDown.vue'
import IconTablerX from '../icons/IconTablerX.vue'

defineEmits<{ close: [] }>()

type SummaryRow = { label: string; value: string; muted?: boolean }
type SummarySection = { id: 'environment' | 'plan' | 'sources'; title: string; rows: SummaryRow[]; emptyLabel: string }

const props = defineProps<{
  cwd: string
  branch: string | null
  headSha: string | null
  headSubject: string | null
  dirty: boolean
  addedLineCount: number
  removedLineCount: number
  planExplanation: string
  planStep: string
  planStepCount: number
  sources: string[]
}>()

const collapsed = reactive<Record<SummarySection['id'], boolean>>({ environment: false, plan: false, sources: false })

const sections = computed<SummarySection[]>(() => [
  {
    id: 'environment',
    title: '环境信息',
    rows: [
      { label: '变更', value: `+${props.addedLineCount}  -${props.removedLineCount}` },
      { label: '本地', value: props.cwd || '未选择目录', muted: !props.cwd },
      { label: '分支', value: props.branch || '未检测到 Git 分支', muted: !props.branch },
      { label: '提交', value: props.headSubject ? `${props.headSubject}${props.headSha ? ` · ${props.headSha.slice(0, 7)}` : ''}` : (props.dirty ? '有未提交变更' : '暂无提交信息'), muted: !props.headSubject && !props.dirty },
    ],
    emptyLabel: '暂无环境信息',
  },
  {
    id: 'plan',
    title: '计划',
    rows: props.planStep || props.planExplanation
      ? [{ label: props.planStepCount > 0 ? `${props.planStepCount} 步` : '当前', value: props.planStep || props.planExplanation }]
      : [],
    emptyLabel: '暂无计划',
  },
  {
    id: 'sources',
    title: '来源',
    rows: props.sources.slice(0, 3).map((source, index) => ({ label: index === 0 ? '最近' : '', value: source })),
    emptyLabel: '暂无附件或来源',
  },
])

function toggle(id: SummarySection['id']): void {
  collapsed[id] = !collapsed[id]
}
</script>

<style scoped>
@reference "tailwindcss";

.thread-summary-panel {
  @apply pointer-events-auto absolute right-3 top-3 z-30 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-zinc-200/90 bg-white/95 shadow-xl backdrop-blur-md;
}

.thread-summary-section + .thread-summary-section {
  @apply border-t border-zinc-200/80;
}

.thread-summary-header {
  @apply flex items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-2.5;
}

.thread-summary-title {
  @apply text-sm font-semibold text-zinc-800;
}

.thread-summary-close {
  @apply grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300;
}

.thread-summary-close :deep(svg) {
  @apply h-4 w-4;
}

.thread-summary-section-toggle {
  @apply flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-50;
}

.thread-summary-section-title {
  @apply truncate;
}

.thread-summary-chevron {
  @apply h-4 w-4 shrink-0 text-zinc-400 transition-transform;
}

.thread-summary-chevron.is-expanded {
  transform: rotate(180deg);
}

.thread-summary-section-body {
  @apply space-y-2 px-4 pb-3;
}

.thread-summary-row {
  @apply flex min-w-0 items-start gap-3 text-xs;
}

.thread-summary-row-label {
  @apply w-12 shrink-0 pt-0.5 text-zinc-400;
}

.thread-summary-row-value {
  @apply min-w-0 flex-1 truncate text-zinc-700;
}

.thread-summary-row-value.is-muted,
.thread-summary-empty {
  @apply text-zinc-400;
}

.thread-summary-empty {
  @apply m-0 text-xs;
}

:global(:root.dark) .thread-summary-panel {
  @apply border-zinc-700/90 bg-zinc-900/95;
}

:global(:root.dark) .thread-summary-section + .thread-summary-section {
  @apply border-zinc-700/80;
}

:global(:root.dark) .thread-summary-header {
  @apply border-zinc-700/80;
}

:global(:root.dark) .thread-summary-title {
  @apply text-zinc-100;
}

:global(:root.dark) .thread-summary-close {
  @apply text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus:ring-zinc-600;
}

:global(:root.dark) .thread-summary-section-toggle {
  @apply text-zinc-100 hover:bg-zinc-800;
}

:global(:root.dark) .thread-summary-row-value {
  @apply text-zinc-200;
}

:global(:root.dark) .thread-summary-row-label,
:global(:root.dark) .thread-summary-row-value.is-muted,
:global(:root.dark) .thread-summary-empty {
  @apply text-zinc-500;
}

</style>
