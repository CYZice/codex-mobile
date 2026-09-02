<template>
  <div class="sidebar-thread-controls" :data-branded="showBrand">
    <div class="sidebar-thread-controls-header">
      <button
        class="sidebar-thread-controls-button"
        type="button"
        :aria-label="isSidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')"
        :title="isSidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')"
        @click="$emit('toggle-sidebar')"
      >
        <IconTablerLayoutSidebarFilled v-if="isSidebarCollapsed" class="sidebar-thread-controls-icon" />
        <IconTablerLayoutSidebar v-else class="sidebar-thread-controls-icon" />
      </button>

      <span v-if="showBrand" class="sidebar-thread-controls-brand">Codex</span>
      <slot />

      <button
        v-if="showNewThreadButton && !showBrand"
        class="sidebar-thread-controls-button"
        type="button"
        :aria-label="t('Start new thread')"
        :title="t('Start new thread')"
        @click="$emit('start-new-thread')"
      >
        <IconTablerFilePencil class="sidebar-thread-controls-icon" />
      </button>
    </div>

    <button
      v-if="showNewThreadButton && showBrand"
      class="sidebar-thread-controls-new-thread"
      type="button"
      @click="$emit('start-new-thread')"
    >
      <IconTablerFilePencil class="sidebar-thread-controls-icon" />
      <span>{{ t('Start new thread') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../../composables/useUiLanguage'
import IconTablerFilePencil from '../icons/IconTablerFilePencil.vue'
import IconTablerLayoutSidebar from '../icons/IconTablerLayoutSidebar.vue'
import IconTablerLayoutSidebarFilled from '../icons/IconTablerLayoutSidebarFilled.vue'

defineProps<{
  isSidebarCollapsed: boolean
  showNewThreadButton?: boolean
  showBrand?: boolean
}>()

defineEmits<{
  'toggle-sidebar': []
  'start-new-thread': []
}>()

const { t } = useUiLanguage()
</script>

<style scoped>
@reference "tailwindcss";

.sidebar-thread-controls {
  @apply flex flex-row flex-nowrap items-center gap-2;
}

.sidebar-thread-controls[data-branded='true'] {
  @apply flex-col items-stretch gap-2;
}

.sidebar-thread-controls-header {
  @apply flex min-w-0 flex-row flex-nowrap items-center gap-2;
}

.sidebar-thread-controls-brand {
  @apply min-w-0 flex-1 truncate text-lg font-semibold tracking-[-0.02em] text-zinc-900;
}

.sidebar-thread-controls-button {
  @apply h-7 w-7 shrink-0 rounded-md border border-transparent bg-transparent text-zinc-500 flex items-center justify-center transition hover:bg-zinc-200 hover:text-zinc-900;
}

.sidebar-thread-controls-icon {
  @apply w-4 h-4;
}

.sidebar-thread-controls-new-thread {
  @apply flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-normal text-zinc-800 transition hover:bg-zinc-200/80;
}

:global(:root.dark) .sidebar-thread-controls-brand {
  @apply text-zinc-100;
}

:global(:root.dark) .sidebar-thread-controls-button {
  @apply text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100;
}

:global(:root.dark) .sidebar-thread-controls-new-thread {
  @apply text-zinc-200 hover:bg-zinc-800;
}
</style>
