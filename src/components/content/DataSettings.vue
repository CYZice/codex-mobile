<script setup lang="ts">
import { computed } from 'vue'
import { useUiLanguage } from '../../composables/useUiLanguage'

type ArchivedThread = {
  id: string
  title: string
  preview: string
  updatedAtIso: string
}

const props = defineProps<{
  isOpen: boolean
  threads: ArchivedThread[]
  cursor: string | null
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  toggle: []
  loadMore: []
  restore: [threadId: string]
}>()

const { t } = useUiLanguage()
const archiveSummary = computed(() => {
  if (props.loading && props.threads.length === 0) return t('Loading archived chats…')
  if (props.threads.length === 0) return t('No archived chats')
  return `${props.threads.length} ${t('archived chats')}`
})
</script>

<template>
  <section id="settings-data" class="settings-data-page">
    <header class="settings-data-header">
      <div>
        <h2>{{ t('Data') }}</h2>
        <p>{{ t('Manage archived chats and local conversation data.') }}</p>
      </div>
      <button class="settings-data-manage-button" type="button" :aria-expanded="isOpen" @click="emit('toggle')">
        {{ isOpen ? t('Hide') : t('Manage archived chats') }}
      </button>
    </header>

    <div class="settings-data-summary">
      <span class="settings-data-summary-icon" aria-hidden="true">▤</span>
      <div>
        <strong>{{ t('Archived chats') }}</strong>
        <p>{{ archiveSummary }}</p>
      </div>
    </div>

    <div v-if="isOpen" class="settings-data-archive-panel">
      <p v-if="error" class="settings-data-error">{{ error }}</p>
      <p v-else-if="loading && threads.length === 0" class="settings-data-help">{{ t('Loading archived chats…') }}</p>
      <p v-else-if="threads.length === 0" class="settings-data-help">{{ t('No archived chats') }}</p>
      <div v-else class="settings-data-archive-list">
        <article v-for="thread in threads" :key="thread.id" class="settings-data-archive-item">
          <div class="settings-data-archive-copy">
            <strong>{{ thread.title }}</strong>
            <span v-if="thread.preview">{{ thread.preview }}</span>
          </div>
          <button type="button" :disabled="loading" @click="emit('restore', thread.id)">{{ t('Restore') }}</button>
        </article>
      </div>
      <button v-if="cursor" class="settings-data-load-more" type="button" :disabled="loading" @click="emit('loadMore')">
        {{ loading ? t('Loading…') : t('Load more') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.settings-data-page { @apply mx-auto w-full max-w-4xl; }
.settings-data-header { @apply mb-7 flex items-start justify-between gap-6; }
.settings-data-header h2 { @apply text-2xl font-semibold; }
.settings-data-header p { @apply mt-1 text-sm text-zinc-500; }
.settings-data-manage-button { @apply shrink-0 rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50; }
.settings-data-summary { @apply flex items-center gap-4 border-y border-zinc-200 py-5; }
.settings-data-summary-icon { @apply flex h-10 w-10 items-center justify-center rounded-xl text-lg; background: color-mix(in srgb, var(--codex-accent) 14%, transparent); color: var(--codex-accent); }
.settings-data-summary strong { @apply text-sm font-semibold; }
.settings-data-summary p { @apply mt-1 text-sm text-zinc-500; }
.settings-data-archive-panel { @apply mt-4 overflow-hidden rounded-2xl border border-zinc-200; }
.settings-data-archive-list { @apply divide-y divide-zinc-200; }
.settings-data-archive-item { @apply flex items-center justify-between gap-5 px-4 py-4; }
.settings-data-archive-copy { @apply flex min-w-0 flex-col; }
.settings-data-archive-copy strong { @apply truncate text-sm; }
.settings-data-archive-copy span { @apply mt-1 line-clamp-2 text-xs text-zinc-500; }
.settings-data-archive-item button,
.settings-data-load-more { @apply shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50; }
.settings-data-load-more { @apply m-4; }
.settings-data-help,
.settings-data-error { @apply px-4 py-5 text-sm text-zinc-500; }
.settings-data-error { @apply text-red-700; }

:global(:root.dark) .settings-data-manage-button,
:global(:root.dark) .settings-data-archive-panel,
:global(:root.dark) .settings-data-archive-item button,
:global(:root.dark) .settings-data-load-more { @apply border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800; }
:global(:root.dark) .settings-data-summary,
:global(:root.dark) .settings-data-archive-list { @apply border-zinc-700 divide-zinc-700; }
:global(:root.dark) .settings-data-header p,
:global(:root.dark) .settings-data-summary p,
:global(:root.dark) .settings-data-archive-copy span,
:global(:root.dark) .settings-data-help { @apply text-zinc-400; }
:global(:root.dark) .settings-data-error { @apply text-red-300; }

@media (max-width: 640px) {
  .settings-data-header { @apply flex-col; }
  .settings-data-manage-button { @apply w-full; }
  .settings-data-archive-item { @apply items-start; }
}
</style>

