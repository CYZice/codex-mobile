<template>
  <div class="personalization-settings">
    <aside class="personalization-settings-rail" aria-label="Settings navigation">
      <p class="personalization-settings-rail-title">{{ t('Settings') }}</p>
      <button class="personalization-settings-rail-item is-active" type="button">
        <IconTablerSettings aria-hidden="true" />
        <span>{{ t('Personalization') }}</span>
      </button>
    </aside>

    <main class="personalization-settings-main">
      <header class="personalization-settings-heading">
        <p class="personalization-settings-eyebrow">{{ t('Personalization') }}</p>
        <h1>{{ t('Custom instructions') }}</h1>
        <p>{{ t('Give Codex additional instructions and context for every chat on this machine.') }}</p>
      </header>

      <section class="personalization-settings-editor" aria-labelledby="global-instructions-title">
        <div class="personalization-settings-editor-header">
          <div>
            <h2 id="global-instructions-title">{{ t('Global instructions') }}</h2>
            <p>{{ t('Stored in AGENTS.md and applied when a new Codex run starts.') }}</p>
          </div>
          <button
            class="personalization-settings-save"
            type="button"
            :disabled="isLoading || isSaving || !hasChanges"
            @click="save"
          >
            {{ isSaving ? t('Saving…') : t('Save') }}
          </button>
        </div>

        <div v-if="isLoading" class="personalization-settings-loading">{{ t('Loading…') }}</div>
        <textarea
          v-else
          v-model="draft"
          class="personalization-settings-textarea"
          spellcheck="false"
          :aria-label="t('Global instructions')"
        />

        <div class="personalization-settings-meta">
          <span v-if="state" :title="state.path">{{ state.path }}</span>
          <span :class="{ 'is-over-limit': byteCount > RECOMMENDED_MAX_BYTES }">
            {{ formatBytes(byteCount) }} / {{ formatBytes(RECOMMENDED_MAX_BYTES) }}
          </span>
        </div>

        <p v-if="state?.isSymlink && state.targetPath" class="personalization-settings-note">
          {{ t('This AGENTS.md is a symbolic link. Saving preserves the link and updates its target:') }}
          <span>{{ state.targetPath }}</span>
        </p>
        <p v-if="state?.overrideActive" class="personalization-settings-warning" role="status">
          {{ t('AGENTS.override.md is active and currently takes precedence over these instructions:') }}
          <span>{{ state.overridePath }}</span>
        </p>
        <p v-if="byteCount > RECOMMENDED_MAX_BYTES" class="personalization-settings-warning" role="status">
          {{ t('This file exceeds the default combined AGENTS.md instruction limit. Some instructions may be truncated.') }}
        </p>
        <p v-if="statusMessage" class="personalization-settings-status" :data-kind="statusKind" role="status" aria-live="polite">
          {{ statusMessage }}
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import IconTablerSettings from '../icons/IconTablerSettings.vue'
import { getGlobalInstructions, saveGlobalInstructions, type GlobalInstructionsState } from '../../api/codexGateway'
import { useUiLanguage } from '../../composables/useUiLanguage'

const RECOMMENDED_MAX_BYTES = 32 * 1024
const { t } = useUiLanguage()
const state = ref<GlobalInstructionsState | null>(null)
const draft = ref('')
const savedContent = ref('')
const isLoading = ref(true)
const isSaving = ref(false)
const statusMessage = ref('')
const statusKind = ref<'success' | 'error'>('success')

const byteCount = computed(() => new TextEncoder().encode(draft.value).byteLength)
const hasChanges = computed(() => draft.value !== savedContent.value)

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`
}

async function load(): Promise<void> {
  isLoading.value = true
  statusMessage.value = ''
  try {
    const nextState = await getGlobalInstructions()
    state.value = nextState
    draft.value = nextState.content
    savedContent.value = nextState.content
  } catch (error) {
    statusKind.value = 'error'
    statusMessage.value = error instanceof Error ? error.message : t('Failed to load global instructions')
  } finally {
    isLoading.value = false
  }
}

async function save(): Promise<void> {
  if (isSaving.value || !hasChanges.value) return
  isSaving.value = true
  statusMessage.value = ''
  try {
    const nextState = await saveGlobalInstructions(draft.value)
    state.value = nextState
    savedContent.value = nextState.content
    draft.value = nextState.content
    statusKind.value = 'success'
    statusMessage.value = t('Saved. New chats and runs will use the updated instructions.')
  } catch (error) {
    statusKind.value = 'error'
    statusMessage.value = error instanceof Error ? error.message : t('Failed to save global instructions')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
@reference "tailwindcss";

.personalization-settings {
  @apply mx-auto grid h-full w-full max-w-[1280px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden;
}

.personalization-settings-rail {
  @apply border-r border-zinc-200 px-4 py-8;
}

.personalization-settings-rail-title {
  @apply mb-4 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400;
}

.personalization-settings-rail-item {
  @apply flex w-full items-center gap-2.5 rounded-xl border-0 bg-zinc-100 px-3 py-2.5 text-left text-sm font-medium text-zinc-900;
}

.personalization-settings-rail-item svg {
  @apply h-4 w-4;
}

.personalization-settings-main {
  @apply min-w-0 overflow-y-auto px-8 py-12;
}

.personalization-settings-heading,
.personalization-settings-editor {
  @apply mx-auto w-full max-w-[820px];
}

.personalization-settings-eyebrow {
  @apply mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600;
}

.personalization-settings-heading h1 {
  @apply text-3xl font-semibold tracking-tight text-zinc-950;
}

.personalization-settings-heading > p:last-child {
  @apply mt-3 max-w-2xl text-sm leading-6 text-zinc-500;
}

.personalization-settings-editor {
  @apply mt-10 border-t border-zinc-200 pt-8;
}

.personalization-settings-editor-header {
  @apply mb-4 flex items-start justify-between gap-6;
}

.personalization-settings-editor h2 {
  @apply text-lg font-semibold text-zinc-900;
}

.personalization-settings-editor-header p {
  @apply mt-1 text-sm text-zinc-500;
}

.personalization-settings-save {
  @apply rounded-full border-0 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400;
}

.personalization-settings-loading {
  @apply flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500;
}

.personalization-settings-textarea {
  @apply min-h-[360px] w-full resize-y rounded-2xl border border-zinc-300 bg-white px-4 py-4 font-mono text-sm leading-6 text-zinc-800 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200;
}

.personalization-settings-meta {
  @apply mt-2 flex items-center justify-between gap-4 text-xs text-zinc-400;
}

.personalization-settings-meta span:first-child {
  @apply min-w-0 truncate;
}

.personalization-settings-meta .is-over-limit {
  @apply shrink-0 text-amber-600;
}

.personalization-settings-note,
.personalization-settings-warning,
.personalization-settings-status {
  @apply mt-4 break-words rounded-xl px-3 py-2.5 text-xs leading-5;
}

.personalization-settings-note {
  @apply bg-zinc-100 text-zinc-600;
}

.personalization-settings-note span,
.personalization-settings-warning span {
  @apply font-mono;
}

.personalization-settings-warning {
  @apply bg-amber-50 text-amber-800;
}

.personalization-settings-status[data-kind='success'] {
  @apply bg-emerald-50 text-emerald-700;
}

.personalization-settings-status[data-kind='error'] {
  @apply bg-red-50 text-red-700;
}

@media (max-width: 1023px) {
  .personalization-settings {
    @apply block overflow-y-auto;
  }

  .personalization-settings-rail {
    @apply border-b border-r-0 px-4 py-3;
  }

  .personalization-settings-rail-title {
    @apply hidden;
  }

  .personalization-settings-rail-item {
    @apply w-auto bg-transparent px-1 py-1 text-xs;
  }

  .personalization-settings-main {
    @apply overflow-visible px-5 py-7;
  }

  .personalization-settings-heading h1 {
    @apply text-2xl;
  }

  .personalization-settings-editor {
    @apply mt-7 pt-6;
  }

  .personalization-settings-editor-header {
    @apply gap-3;
  }

  .personalization-settings-textarea {
    @apply min-h-[48dvh] text-base;
  }
}
</style>
