<template>
  <div ref="rootRef" class="model-settings-dropdown">
    <button
      class="model-settings-trigger"
      type="button"
      :aria-label="triggerLabel"
      :title="triggerLabel"
      :disabled="disabled"
      @click="onToggle"
    >
      <span class="model-settings-value">{{ triggerLabel }}</span>
      <IconTablerChevronDown class="model-settings-trigger-chevron" />
    </button>

    <Teleport to="body">
      <div v-if="isOpen" ref="menuWrapRef" class="model-settings-menu-wrap" :style="menuWrapStyle">
        <section ref="menuRef" class="model-settings-menu" :aria-label="modelLabel">
          <template v-if="activePanel === 'settings'">
            <p class="model-settings-section-label">{{ thinkingLabel }}</p>
            <div class="model-settings-option-list" role="listbox" :aria-label="thinkingLabel">
              <button
                v-for="option in reasoningOptions"
                :key="option.value"
                class="model-settings-option"
                :class="{ 'is-selected': option.value === reasoningValue }"
                type="button"
                @click="selectReasoning(option.value)"
              >
                <span>{{ option.label }}</span>
                <span v-if="option.value === reasoningValue" class="model-settings-selected-mark" aria-label="Selected" />
              </button>
            </div>

            <div class="model-settings-divider" />
            <button class="model-settings-navigation-row" type="button" @click="openModels">
              <span class="model-settings-navigation-copy">
                <span class="model-settings-navigation-label">{{ modelLabel }}</span>
                <span class="model-settings-navigation-value">{{ selectedModelLabel }}</span>
              </span>
              <IconTablerChevronDown class="model-settings-navigation-chevron" />
            </button>
          </template>

          <template v-else>
            <div class="model-settings-model-header">
              <button class="model-settings-back" type="button" :aria-label="thinkingLabel" @click="activePanel = 'settings'">
                <IconTablerChevronDown />
              </button>
              <span>{{ modelLabel }}</span>
            </div>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="model-settings-search"
              type="text"
              :placeholder="searchPlaceholder"
              @keydown.escape.prevent="activePanel = 'settings'"
            />
            <div class="model-settings-option-list model-settings-model-list" role="listbox" :aria-label="modelLabel">
              <button
                v-for="option in filteredModelOptions"
                :key="option.value"
                class="model-settings-option"
                :class="{ 'is-selected': option.value === modelValue }"
                type="button"
                @click="selectModel(option.value)"
              >
                <span>{{ option.label }}</span>
                <span v-if="option.value === modelValue" class="model-settings-selected-mark" aria-label="Selected" />
              </button>
              <p v-if="filteredModelOptions.length === 0" class="model-settings-empty">No results</p>
            </div>
          </template>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconTablerChevronDown from '../icons/IconTablerChevronDown.vue'

type DropdownOption = {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  modelOptions: DropdownOption[]
  reasoningValue: string
  reasoningOptions: DropdownOption[]
  placeholder: string
  modelLabel: string
  thinkingLabel: string
  searchPlaceholder: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:reasoningValue': [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const menuWrapRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const activePanel = ref<'settings' | 'models'>('settings')
const searchQuery = ref('')
const menuWrapStyle = ref<Record<string, string>>({})
let hasLayoutListeners = false

const selectedModelLabel = computed(() => (
  props.modelOptions.find((option) => option.value === props.modelValue)?.label ?? props.placeholder
))
const selectedReasoningLabel = computed(() => (
  props.reasoningOptions.find((option) => option.value === props.reasoningValue)?.label ?? ''
))
const triggerLabel = computed(() => [selectedModelLabel.value, selectedReasoningLabel.value].filter(Boolean).join(' '))
const filteredModelOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.modelOptions
  return props.modelOptions.filter((option) => (
    option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
  ))
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function updateMenuPosition(): void {
  if (!isOpen.value || typeof window === 'undefined') return
  const root = rootRef.value
  if (!root) return

  const rect = root.getBoundingClientRect()
  const isMobileViewport = window.innerWidth <= 639
  const viewportPadding = isMobileViewport ? 16 : 8
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const measuredHeight = menuRef.value?.offsetHeight ?? menuWrapRef.value?.offsetHeight ?? 360
  const width = Math.max(0, Math.min(isMobileViewport ? 520 : 320, viewportWidth - viewportPadding * 2))
  const left = isMobileViewport
    ? viewportPadding
    : clamp(rect.left, viewportPadding, Math.max(viewportPadding, viewportWidth - width - viewportPadding))
  const top = clamp(
    rect.top - measuredHeight - 12,
    viewportPadding,
    Math.max(viewportPadding, viewportHeight - measuredHeight - viewportPadding),
  )

  menuWrapStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  }
}

function addLayoutListeners(): void {
  if (hasLayoutListeners || typeof window === 'undefined') return
  window.addEventListener('resize', updateMenuPosition)
  window.addEventListener('scroll', updateMenuPosition, true)
  hasLayoutListeners = true
}

function removeLayoutListeners(): void {
  if (!hasLayoutListeners || typeof window === 'undefined') return
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
  hasLayoutListeners = false
}

function onToggle(): void {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function openModels(): void {
  activePanel.value = 'models'
  searchQuery.value = ''
  void nextTick(() => {
    searchInputRef.value?.focus()
    updateMenuPosition()
  })
}

function selectReasoning(value: string): void {
  emit('update:reasoningValue', value)
  isOpen.value = false
}

function selectModel(value: string): void {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!isOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  isOpen.value = false
}

watch(isOpen, (open) => {
  if (!open) {
    removeLayoutListeners()
    menuWrapStyle.value = {}
    activePanel.value = 'settings'
    return
  }
  addLayoutListeners()
  nextTick(() => {
    updateMenuPosition()
    window.requestAnimationFrame(updateMenuPosition)
  })
})

onMounted(() => {
  window.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onDocumentPointerDown)
  removeLayoutListeners()
})
</script>

<style scoped>
@reference "tailwindcss";

.model-settings-dropdown {
  @apply relative inline-flex min-w-0;
}

.model-settings-trigger {
  @apply inline-flex min-h-7 min-w-0 items-center gap-1 border-0 bg-transparent px-0 py-0.5 text-sm leading-tight text-zinc-500 outline-none transition hover:text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-500;
}

.model-settings-value {
  @apply truncate whitespace-nowrap pb-px text-left;
}

.model-settings-trigger-chevron {
  @apply mt-px h-3.5 w-3.5 shrink-0;
}

.model-settings-menu-wrap {
  @apply z-[160];
}

.model-settings-menu {
  @apply overflow-hidden border border-zinc-200 bg-white p-2 shadow-xl;
  border-radius: 14px;
}

.model-settings-section-label {
  @apply px-2 py-1.5 text-xs font-semibold text-zinc-500;
}

.model-settings-option-list {
  @apply grid;
}

.model-settings-option {
  @apply flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent px-2 py-2 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-100;
}

.model-settings-option.is-selected {
  @apply bg-zinc-100;
}

.model-settings-selected-mark {
  @apply inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-700;
}

.model-settings-selected-mark::before {
  content: '\2713';
  @apply text-xl leading-none;
}

.model-settings-divider {
  @apply my-2 h-px bg-zinc-200;
}

.model-settings-navigation-row {
  @apply flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent px-2 py-2.5 text-left transition hover:bg-zinc-100;
}

.model-settings-navigation-copy {
  @apply grid min-w-0 gap-0.5;
}

.model-settings-navigation-label {
  @apply text-sm font-semibold text-zinc-800;
}

.model-settings-navigation-value {
  @apply truncate text-sm text-zinc-500;
}

.model-settings-navigation-chevron {
  @apply h-4 w-4 shrink-0 -rotate-90 text-zinc-500;
}

.model-settings-model-header {
  @apply flex items-center gap-1 px-1 pb-2 text-sm font-semibold text-zinc-800;
}

.model-settings-back {
  @apply inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-600 transition hover:bg-zinc-100;
}

.model-settings-back :deep(svg) {
  @apply h-4 w-4 rotate-90;
}

.model-settings-search {
  @apply mb-2 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400;
}

.model-settings-model-list {
  @apply max-h-64 overflow-y-auto;
}

.model-settings-empty {
  @apply px-2 py-3 text-sm text-zinc-500;
}

@media (max-width: 639px) {
  .model-settings-menu {
    @apply p-3;
    border-radius: 22px;
  }

  .model-settings-section-label {
    @apply px-3 pt-1.5 text-[15px];
  }

  .model-settings-option {
    @apply min-h-12 rounded-xl px-3 text-[17px];
  }

  .model-settings-navigation-row {
    @apply rounded-xl px-3 py-3;
  }

  .model-settings-navigation-label,
  .model-settings-navigation-value {
    @apply text-[15px];
  }
}
</style>
