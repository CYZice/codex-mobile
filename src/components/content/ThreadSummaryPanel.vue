<template>
  <aside class="thread-summary-panel" aria-label="Thread summary">
    <header class="thread-summary-header">
      <span class="thread-summary-title">摘要</span>
      <button class="thread-summary-icon-button" type="button" aria-label="隐藏摘要" title="隐藏摘要" @click="$emit('close')">
        <IconTablerX aria-hidden="true" />
      </button>
    </header>

    <section class="thread-summary-section">
      <div class="thread-summary-section-heading">环境信息</div>
      <div class="thread-summary-action-list">
        <button class="thread-summary-action-row" type="button" title="查看工作区变更" @click="$emit('openChanges')">
          <IconTablerFilePencil class="thread-summary-action-icon" />
          <span class="thread-summary-action-label">变更</span>
          <span class="thread-summary-change-counts">
            <span class="is-added">+{{ addedLineCount }}</span>
            <span class="is-removed">-{{ removedLineCount }}</span>
          </span>
        </button>

        <button class="thread-summary-action-row" type="button" :title="cwd || '未选择目录'" :disabled="!cwd" @click="$emit('openLocal')">
          <IconTablerFolder class="thread-summary-action-icon" />
          <span class="thread-summary-action-label">本地</span>
          <span class="thread-summary-action-value">{{ cwdLabel }}</span>
          <IconTablerChevronRight class="thread-summary-row-chevron" />
        </button>

        <div class="thread-summary-branch-control">
          <button class="thread-summary-action-row" type="button" :disabled="branches.length === 0" :aria-expanded="isBranchMenuOpen" @click="toggleBranchMenu">
            <IconTablerGitFork class="thread-summary-action-icon" />
            <span class="thread-summary-action-label">分支</span>
            <span class="thread-summary-action-value">{{ branch || '未检测到分支' }}</span>
            <IconTablerChevronDown class="thread-summary-row-chevron" :class="{ 'is-expanded': isBranchMenuOpen }" />
          </button>
          <div v-if="isBranchMenuOpen" class="thread-summary-branch-menu">
            <div class="thread-summary-branch-search-wrap">
              <IconTablerSearch aria-hidden="true" />
              <input v-model="branchQuery" class="thread-summary-branch-search" type="text" placeholder="搜索分支" />
            </div>
            <div class="thread-summary-branch-list">
              <button
                v-for="branchOption in filteredBranches"
                :key="branchOption.value"
                class="thread-summary-branch-option"
                :class="{ 'is-current': branchOption.value === branch }"
                type="button"
                :disabled="branchBusy"
                @click="selectBranch(branchOption.value)"
              >
                <IconTablerGitFork aria-hidden="true" />
                <span>{{ branchOption.label }}</span>
                <span v-if="branchOption.value === branch" class="thread-summary-current-label">当前</span>
                <span v-else-if="branchOption.isRemote" class="thread-summary-current-label">远程</span>
              </button>
              <p v-if="filteredBranches.length === 0" class="thread-summary-empty">没有匹配的分支</p>
            </div>
            <p v-if="branchError" class="thread-summary-branch-error">{{ branchError }}</p>
          </div>
        </div>

        <button class="thread-summary-action-row" type="button" :disabled="!headSha && !headSubject" title="打开提交历史" @click="$emit('openGit')">
          <IconTablerGitCommit class="thread-summary-action-icon" />
          <span class="thread-summary-action-label">提交</span>
          <span class="thread-summary-action-value">{{ commitLabel }}</span>
          <IconTablerChevronRight class="thread-summary-row-chevron" />
        </button>
      </div>
    </section>

    <section class="thread-summary-section">
      <button class="thread-summary-section-toggle" type="button" :aria-expanded="!collapsed.plan" @click="collapsed.plan = !collapsed.plan">
        <span class="thread-summary-section-title">计划</span>
        <IconTablerChevronDown class="thread-summary-chevron" :class="{ 'is-expanded': !collapsed.plan }" aria-hidden="true" />
      </button>
      <div v-if="!collapsed.plan" class="thread-summary-section-body">
        <div v-if="planStep || planExplanation" class="thread-summary-plan-row">
          <span class="thread-summary-plan-label">{{ planStepCount > 0 ? `${planStepCount} 步` : '当前' }}</span>
          <span class="thread-summary-plan-value">{{ planStep || planExplanation }}</span>
        </div>
        <p v-else class="thread-summary-empty">暂无计划</p>
      </div>
    </section>

    <section class="thread-summary-section">
      <button class="thread-summary-section-toggle" type="button" :aria-expanded="!collapsed.sources" @click="collapsed.sources = !collapsed.sources">
        <span class="thread-summary-section-title">来源</span>
        <IconTablerChevronDown class="thread-summary-chevron" :class="{ 'is-expanded': !collapsed.sources }" aria-hidden="true" />
      </button>
      <div v-if="!collapsed.sources" class="thread-summary-source-list">
        <a
          v-for="source in sources"
          :key="source.id"
          class="thread-summary-source-link"
          :href="source.href"
          :title="source.title"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconTablerPhoto v-if="source.kind === 'image'" class="thread-summary-source-icon" />
          <IconTablerLink v-else-if="source.kind === 'link'" class="thread-summary-source-icon" />
          <IconTablerBolt v-else-if="source.kind === 'skill'" class="thread-summary-source-icon" />
          <IconTablerFileText v-else class="thread-summary-source-icon" />
          <span>{{ source.label }}</span>
          <IconTablerChevronRight class="thread-summary-source-chevron" />
        </a>
        <p v-if="sources.length === 0" class="thread-summary-empty thread-summary-source-empty">暂无附件或来源</p>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ThreadSummarySource } from '../../threadSummarySources'
import IconTablerBolt from '../icons/IconTablerBolt.vue'
import IconTablerChevronDown from '../icons/IconTablerChevronDown.vue'
import IconTablerChevronRight from '../icons/IconTablerChevronRight.vue'
import IconTablerFilePencil from '../icons/IconTablerFilePencil.vue'
import IconTablerFileText from '../icons/IconTablerFileText.vue'
import IconTablerFolder from '../icons/IconTablerFolder.vue'
import IconTablerGitCommit from '../icons/IconTablerGitCommit.vue'
import IconTablerGitFork from '../icons/IconTablerGitFork.vue'
import IconTablerLink from '../icons/IconTablerLink.vue'
import IconTablerPhoto from '../icons/IconTablerPhoto.vue'
import IconTablerSearch from '../icons/IconTablerSearch.vue'
import IconTablerX from '../icons/IconTablerX.vue'

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
  sources: ThreadSummarySource[]
  branches: Array<{ label: string; value: string; isRemote?: boolean }>
  branchBusy: boolean
  branchError: string
}>()

const emit = defineEmits<{
  close: []
  openChanges: []
  openLocal: []
  openGit: []
  checkoutBranch: [branch: string]
}>()

const collapsed = reactive({ plan: false, sources: false })
const isBranchMenuOpen = ref(false)
const branchQuery = ref('')

const cwdLabel = computed(() => {
  const normalized = props.cwd.replace(/[\\/]+$/u, '')
  const parts = normalized.split(/[\\/]/u)
  return parts.at(-1) || props.cwd || '未选择目录'
})
const commitLabel = computed(() => {
  const subject = props.headSubject?.trim() ?? ''
  const sha = props.headSha?.trim().slice(0, 7) ?? ''
  if (subject && sha) return `${subject} · ${sha}`
  return subject || sha || (props.dirty ? '有未提交变更' : '暂无提交信息')
})
const filteredBranches = computed(() => {
  const query = branchQuery.value.trim().toLowerCase()
  const branches = [...props.branches].sort((first, second) => {
    if (first.value === props.branch) return -1
    if (second.value === props.branch) return 1
    if (first.isRemote === true && second.isRemote !== true) return 1
    if (first.isRemote !== true && second.isRemote === true) return -1
    return first.label.localeCompare(second.label)
  })
  if (!query) return branches
  return branches.filter((option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query))
})

function toggleBranchMenu(): void {
  isBranchMenuOpen.value = !isBranchMenuOpen.value
  if (!isBranchMenuOpen.value) branchQuery.value = ''
}

function selectBranch(value: string): void {
  isBranchMenuOpen.value = false
  branchQuery.value = ''
  if (value === props.branch) return
  emit('checkoutBranch', value)
}
</script>

<style scoped>
@reference "tailwindcss";

.thread-summary-panel {
  @apply pointer-events-auto absolute right-3 top-3 z-30 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl;
}

.thread-summary-header,
.thread-summary-section-heading {
  @apply flex items-center justify-between gap-3 px-4;
}

.thread-summary-header {
  @apply h-11 border-b border-zinc-200;
}

.thread-summary-title,
.thread-summary-section-title {
  @apply truncate text-sm font-semibold text-zinc-800;
}

.thread-summary-icon-button {
  @apply grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300;
}

.thread-summary-icon-button :deep(svg),
.thread-summary-action-icon,
.thread-summary-row-chevron,
.thread-summary-chevron,
.thread-summary-source-icon,
.thread-summary-source-chevron,
.thread-summary-branch-search-wrap :deep(svg),
.thread-summary-branch-option :deep(svg) {
  @apply h-4 w-4 shrink-0;
}

.thread-summary-section + .thread-summary-section {
  @apply border-t border-zinc-200;
}

.thread-summary-section-heading {
  @apply h-10 text-xs font-medium text-zinc-400;
}

.thread-summary-action-list {
  @apply px-2 pb-2;
}

.thread-summary-action-row,
.thread-summary-source-link {
  @apply flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-default disabled:opacity-50;
}

.thread-summary-action-label {
  @apply shrink-0 font-medium text-zinc-800;
}

.thread-summary-action-value {
  @apply min-w-0 flex-1 truncate text-right text-xs text-zinc-500;
}

.thread-summary-row-chevron,
.thread-summary-source-chevron {
  @apply text-zinc-400 transition-transform;
}

.thread-summary-row-chevron.is-expanded,
.thread-summary-chevron.is-expanded {
  transform: rotate(180deg);
}

.thread-summary-change-counts {
  @apply ml-auto flex items-center gap-1.5 font-mono text-xs;
}

.thread-summary-change-counts .is-added {
  @apply text-emerald-600;
}

.thread-summary-change-counts .is-removed {
  @apply text-rose-600;
}

.thread-summary-branch-menu {
  @apply mx-2 mb-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg;
}

.thread-summary-branch-search-wrap {
  @apply flex items-center gap-2 border-b border-zinc-200 px-3 text-zinc-400;
}

.thread-summary-branch-search {
  @apply h-9 min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400;
}

.thread-summary-branch-list {
  @apply max-h-52 overflow-y-auto p-1;
}

.thread-summary-branch-option {
  @apply flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50;
}

.thread-summary-branch-option > span:nth-child(2) {
  @apply min-w-0 flex-1 truncate;
}

.thread-summary-branch-option.is-current {
  @apply bg-zinc-100 font-medium text-zinc-900;
}

.thread-summary-current-label {
  @apply shrink-0 text-[11px] font-normal text-zinc-400;
}

.thread-summary-branch-error {
  @apply m-0 border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700;
}

.thread-summary-section-toggle {
  @apply flex h-10 w-full items-center justify-between gap-3 px-4 text-left transition hover:bg-zinc-50;
}

.thread-summary-chevron {
  @apply text-zinc-400 transition-transform;
}

.thread-summary-section-body {
  @apply px-4 pb-3;
}

.thread-summary-plan-row {
  @apply flex min-w-0 items-start gap-3 text-xs;
}

.thread-summary-plan-label {
  @apply w-12 shrink-0 text-zinc-400;
}

.thread-summary-plan-value {
  @apply min-w-0 flex-1 text-zinc-700;
}

.thread-summary-source-list {
  @apply space-y-0.5 px-2 pb-2;
}

.thread-summary-source-link {
  @apply no-underline;
}

.thread-summary-source-link > span {
  @apply min-w-0 flex-1 truncate;
}

.thread-summary-source-icon {
  @apply text-zinc-500;
}

.thread-summary-empty {
  @apply m-0 px-2 py-2 text-xs text-zinc-400;
}

.thread-summary-source-empty {
  @apply px-2 pb-3;
}
</style>
