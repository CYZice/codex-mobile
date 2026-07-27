<template>
  <Teleport to="body">
    <div v-if="open" class="full-access-confirmation-backdrop" @mousedown.self="emit('cancel')">
      <section
        class="full-access-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-access-confirmation-title"
      >
        <h2 id="full-access-confirmation-title">Enable Full Access?</h2>
        <p>
          Full Access allows Codex to modify files outside this project, run system commands, and access network resources without asking.
        </p>
        <div class="full-access-confirmation-actions">
          <button type="button" class="full-access-confirmation-cancel" @click="emit('cancel')">Cancel</button>
          <button type="button" class="full-access-confirmation-confirm" @click="emit('confirm')">Enable Full Access</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') {
    emit('cancel')
  }
}

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
@reference "tailwindcss";

.full-access-confirmation-backdrop {
  @apply fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4;
}

.full-access-confirmation {
  @apply w-full max-w-md border border-zinc-200 bg-white p-5 shadow-xl;
  border-radius: 6px;
}

.full-access-confirmation h2 {
  @apply text-base font-semibold leading-tight text-zinc-900;
}

.full-access-confirmation p {
  @apply mt-3 text-sm leading-6 text-zinc-600;
}

.full-access-confirmation-actions {
  @apply mt-5 flex justify-end gap-2;
}

.full-access-confirmation-cancel,
.full-access-confirmation-confirm {
  @apply min-h-8 px-3 text-sm font-medium transition;
  border-radius: 4px;
}

.full-access-confirmation-cancel {
  @apply border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50;
}

.full-access-confirmation-confirm {
  @apply bg-red-700 text-white hover:bg-red-800;
}

</style>
