<template>
  <div ref="rootRef" class="permissions-dropdown">
    <button
      class="permissions-dropdown-trigger"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="`Permissions: ${selectedOption.label}`"
      :title="`Permissions: ${selectedOption.label}`"
      :disabled="disabled"
      @click="isOpen = !isOpen"
    >
      <span class="permissions-dropdown-value">
        <span class="permissions-dropdown-prefix">Permissions: </span>{{ selectedOption.shortLabel }}
      </span>
      <IconTablerChevronDown class="permissions-dropdown-chevron" />
    </button>

    <div
      v-if="isOpen"
      ref="menuWrapRef"
      class="permissions-dropdown-menu-wrap"
      :style="menuWrapStyle"
    >
      <div ref="menuRef" class="permissions-dropdown-menu" role="menu" aria-label="Permissions">
        <button
          v-for="option in permissionOptions"
          :key="option.value"
          class="permissions-dropdown-option"
          :class="{ 'is-selected': option.value === modelValue }"
          type="button"
          role="menuitemradio"
          :aria-checked="option.value === modelValue"
          @click="select(option.value)"
        >
          <span class="permissions-dropdown-option-copy">
            <span class="permissions-dropdown-option-title">{{ option.label }}</span>
            <span class="permissions-dropdown-option-description">{{ option.description }}</span>
          </span>
          <span
            v-if="option.value === modelValue"
            class="permissions-dropdown-selected-mark"
            aria-label="Selected"
          />
        </button>
        <p v-if="isTurnInProgress" class="permissions-dropdown-next-turn">
          Applies to the next message
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PermissionPreset } from '../../permissions'
import IconTablerChevronDown from '../icons/IconTablerChevronDown.vue'

const props = defineProps<{
  modelValue: PermissionPreset
  disabled?: boolean
  isTurnInProgress?: boolean
}>()

const emit = defineEmits<{
  select: [preset: PermissionPreset]
}>()

const permissionOptions: Array<{
  value: PermissionPreset
  shortLabel: string
  label: string
  description: string
}> = [
  {
    value: 'workspace',
    shortLabel: 'Workspace',
    label: 'Workspace access',
    description: 'Project files and network; asks before broader access',
  },
  {
    value: 'fullAccess',
    shortLabel: 'Full access',
    label: 'Full access',
    description: 'Can access files outside this project and run commands without approval',
  },
]

const rootRef = ref<HTMLElement | null>(null)
const menuWrapRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const menuWrapStyle = ref<Record<string, string>>({})
let hasLayoutListeners = false

const selectedOption = computed(() => (
  permissionOptions.find((option) => option.value === props.modelValue) ?? permissionOptions[0]
))

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
  const measuredHeight = menuRef.value?.offsetHeight ?? menuWrapRef.value?.offsetHeight ?? 180
  const width = Math.max(0, Math.min(isMobileViewport ? 520 : 328, viewportWidth - viewportPadding * 2))
  const left = isMobileViewport
    ? viewportPadding
    : clamp(rect.left, viewportPadding, Math.max(viewportPadding, viewportWidth - width - viewportPadding))
  const top = clamp(
    rect.top - measuredHeight - (isMobileViewport ? 12 : 8),
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

function select(preset: PermissionPreset): void {
  isOpen.value = false
  emit('select', preset)
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!isOpen.value) return
  const root = rootRef.value
  const target = event.target
  if (!root || !(target instanceof Node) || root.contains(target)) return
  isOpen.value = false
}

watch(isOpen, (open) => {
  if (!open) {
    removeLayoutListeners()
    menuWrapStyle.value = {}
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

.permissions-dropdown {
  @apply relative inline-flex min-w-0;
}

.permissions-dropdown-trigger {
  @apply inline-flex min-h-7 min-w-0 items-center gap-1 border-0 bg-transparent px-0 py-0.5 text-sm leading-tight text-zinc-500 outline-none transition hover:text-zinc-700;
}

.permissions-dropdown-trigger:disabled {
  @apply cursor-not-allowed text-zinc-500;
}

.permissions-dropdown-value {
  @apply truncate whitespace-nowrap pb-px text-left;
}

.permissions-dropdown-chevron {
  @apply mt-px h-3.5 w-3.5 shrink-0;
}

.permissions-dropdown-menu-wrap {
  @apply z-50;
}

.permissions-dropdown-menu {
  @apply overflow-hidden border border-zinc-200 bg-white shadow-lg;
  border-radius: 6px;
}

.permissions-dropdown-option {
  @apply flex w-full items-start justify-between gap-4 px-3 py-2.5 text-left transition hover:bg-zinc-50;
}

.permissions-dropdown-option.is-selected {
  @apply bg-zinc-100;
}

.permissions-dropdown-option-copy {
  @apply grid min-w-0 gap-0.5;
}

.permissions-dropdown-option-title {
  @apply text-sm font-medium leading-tight text-zinc-900;
}

.permissions-dropdown-option-description {
  @apply text-xs leading-snug text-zinc-500;
}

.permissions-dropdown-selected-mark {
  @apply inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-700;
}

.permissions-dropdown-selected-mark::before {
  content: '\2713';
  @apply text-xl leading-none;
}

.permissions-dropdown-next-turn {
  @apply border-t border-zinc-100 px-3 py-2 text-xs leading-snug text-zinc-500;
}

@media (max-width: 639px) {
  .permissions-dropdown-prefix {
    @apply hidden;
  }

  .permissions-dropdown-menu {
    @apply p-2;
    border-radius: 20px;
  }

  .permissions-dropdown-option {
    @apply items-center rounded-xl px-3 py-3.5;
  }

  .permissions-dropdown-option-title {
    @apply text-[15px];
  }

  .permissions-dropdown-option-description {
    @apply text-[13px] leading-5;
  }

  .permissions-dropdown-next-turn {
    @apply mx-1 px-2 py-2.5;
  }
}

</style>
