<template>
  <div v-if="visible" class="skill-picker" role="listbox" aria-label="Skills">
    <div class="skill-picker-label">{{ t('Skills') }}</div>
    <ul v-if="skills.length > 0" class="skill-picker-list">
      <li v-for="(skill, index) in skills" :key="skill.path">
        <button
          class="skill-picker-item"
          :class="{ 'is-highlighted': index === highlightedIndex }"
          type="button"
          role="option"
          :aria-selected="index === highlightedIndex"
          @mousedown.prevent="$emit('select', skill)"
          @pointerenter="$emit('highlight', index)"
        >
          <span class="skill-picker-name">${{ skill.displayName || skill.name }}</span>
          <span v-if="skill.description" class="skill-picker-desc">{{ skill.description }}</span>
        </button>
      </li>
    </ul>
    <div v-else class="skill-picker-empty">{{ t('No skills found') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../../composables/useUiLanguage'

export type SkillOption = {
  name: string
  displayName?: string
  description: string
  path: string
}

defineProps<{
  skills: SkillOption[]
  visible: boolean
  highlightedIndex: number
}>()

defineEmits<{
  select: [skill: SkillOption]
  highlight: [index: number]
}>()

const { t } = useUiLanguage()
</script>

<style scoped>
@reference "tailwindcss";

.skill-picker {
  @apply absolute bottom-[calc(100%+8px)] left-0 z-40 flex max-h-64 w-80 max-w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg;
}

.skill-picker-label {
  @apply px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500;
}

.skill-picker-list {
  @apply m-0 list-none overflow-y-auto p-0;
}

.skill-picker-item {
  @apply flex w-full flex-col items-start gap-0.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left transition hover:bg-zinc-100;
}

.skill-picker-item.is-highlighted {
  @apply bg-zinc-100;
}

.skill-picker-name {
  @apply text-sm font-medium text-zinc-800;
}

.skill-picker-desc {
  @apply line-clamp-1 text-xs text-zinc-500;
}

.skill-picker-empty {
  @apply px-2.5 py-2 text-sm text-zinc-500;
}

:global(:root.dark) .skill-picker {
  @apply border-zinc-700 bg-zinc-900 shadow-black/30;
}

:global(:root.dark) .skill-picker-label,
:global(:root.dark) .skill-picker-empty,
:global(:root.dark) .skill-picker-desc {
  @apply text-zinc-400;
}

:global(:root.dark) .skill-picker-name {
  @apply text-zinc-100;
}

:global(:root.dark) .skill-picker-item:hover,
:global(:root.dark) .skill-picker-item.is-highlighted {
  @apply bg-zinc-800;
}
</style>
