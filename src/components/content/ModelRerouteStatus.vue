<template>
  <div
    class="model-reroute-status"
    :class="{ 'is-rerouted': reroute }"
    role="status"
    aria-live="polite"
    :title="reroute ? t('Codex app-server reported a model reroute for this turn.') : t('No upstream model has been reported for this turn.')"
  >
    <span>{{ t('Selected') }} <strong>{{ reroute?.fromModel || selectedModel }}</strong></span>
    <span class="model-reroute-separator" aria-hidden="true">·</span>
    <span v-if="reroute">↪ {{ t('Upstream reported') }} <strong>{{ reroute.toModel }}</strong></span>
    <span v-else>{{ t('Upstream not reported') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../../composables/useUiLanguage'
import type { ModelReroute } from '../../modelReroute'

defineProps<{
  selectedModel: string
  reroute: ModelReroute | null
}>()

const { t } = useUiLanguage()
</script>

<style scoped>
@reference "tailwindcss";

.model-reroute-status {
  @apply flex max-w-full flex-wrap items-center gap-x-1.5 px-2 pt-1.5 text-[11px] leading-4 text-zinc-500;
}

.model-reroute-status strong {
  @apply font-medium text-zinc-700;
  overflow-wrap: anywhere;
}

.model-reroute-status.is-rerouted {
  @apply text-amber-700;
}

.model-reroute-status.is-rerouted strong {
  @apply text-amber-800;
}

.model-reroute-separator {
  @apply text-zinc-400;
}
</style>
