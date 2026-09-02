<template>
  <div class="settings-center">
    <aside class="settings-center-nav" aria-label="Settings navigation">
      <p class="settings-center-nav-title">{{ t('Settings') }}</p>
      <button
        v-for="section in sections"
        :key="section.id"
        class="settings-center-nav-item"
        :class="{ 'is-active': activeSection === section.id }"
        type="button"
        @click="emit('select-section', section.id)"
      >
        {{ t(section.label) }}
      </button>
    </aside>
    <main id="settings-center-content" class="settings-center-main" />
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../../composables/useUiLanguage'

defineProps<{ activeSection: string }>()

const emit = defineEmits<{ 'select-section': [section: string] }>()
const { t } = useUiLanguage()

const sections = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'input', label: 'Input' },
  { id: 'voice', label: 'Voice' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'archived', label: 'Archived chats' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'account', label: 'Accounts & limits' },
]
</script>

<style scoped>
@reference "tailwindcss";

.settings-center { @apply mx-auto grid h-full w-full max-w-[1280px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden; }
.settings-center-nav { @apply border-r border-zinc-200 px-4 py-8; }
.settings-center-nav-title { @apply mb-4 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400; }
.settings-center-nav-item { @apply mb-1 flex w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900; }
.settings-center-nav-item.is-active { @apply bg-zinc-100 text-zinc-950; }
.settings-center-main { @apply min-w-0 overflow-y-auto px-8 py-10; }

@media (max-width: 1023px) {
  .settings-center { @apply block overflow-y-auto; }
  .settings-center-nav { @apply flex gap-1 overflow-x-auto border-b border-r-0 px-3 py-2; }
  .settings-center-nav-title { @apply hidden; }
  .settings-center-nav-item { @apply mb-0 w-auto shrink-0 px-3 py-2 text-xs; }
  .settings-center-main { @apply overflow-visible px-4 py-6; }
}
</style>
