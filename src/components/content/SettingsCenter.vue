<template>
  <div class="settings-center">
    <aside class="settings-center-nav" aria-label="Settings navigation">
      <p class="settings-center-nav-title">{{ t('Settings') }}</p>
      <input v-model="query" class="settings-center-search" type="search" :placeholder="t('Search settings')">
      <button
        v-for="section in filteredSections"
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
import { computed, ref } from 'vue'
import { useUiLanguage } from '../../composables/useUiLanguage'

defineProps<{ activeSection: string }>()

const emit = defineEmits<{ 'select-section': [section: string] }>()
const { t } = useUiLanguage()
const query = ref('')

const sections = [
  { id: 'general', label: 'General' },
  { id: 'agent', label: 'Agent' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'voice', label: 'Voice' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'activity', label: 'Activity' },
  { id: 'data', label: 'Data' },
  { id: 'account', label: 'Accounts & limits' },
]
const filteredSections = computed(() => sections.filter(section => t(section.label).toLowerCase().includes(query.value.trim().toLowerCase())))
</script>

<style scoped>
@reference "tailwindcss";

.settings-center { @apply mx-auto grid h-full w-full max-w-[1280px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden; }
.settings-center-nav { @apply border-r border-zinc-200 px-4 py-8; }
.settings-center-nav-title { @apply mb-4 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400; }
.settings-center-search { @apply mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500; }
.settings-center-nav-item { @apply mb-1 flex w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900; }
.settings-center-nav-item.is-active { @apply bg-zinc-100 text-zinc-950; }
.settings-center-main { @apply min-w-0 overflow-y-auto px-8 py-10; }

@media (max-width: 1023px) {
  .settings-center { @apply grid h-full grid-cols-[124px_minmax(0,1fr)] overflow-hidden; }
  .settings-center-nav { @apply overflow-y-auto border-r border-zinc-200 px-2 py-5; }
  .settings-center-nav-title { @apply mb-3 px-2 text-[10px]; }
  .settings-center-search { @apply hidden; }
  .settings-center-nav-item { @apply mb-1 w-full whitespace-normal px-2 py-2 text-xs leading-tight; }
  .settings-center-main { @apply min-h-0 overflow-y-auto px-3 py-5; }
}

@media (max-width: 420px) {
  .settings-center { @apply grid-cols-[108px_minmax(0,1fr)]; }
  .settings-center-nav { @apply px-1.5; }
  .settings-center-nav-item { @apply px-2 text-[11px]; }
}
</style>
