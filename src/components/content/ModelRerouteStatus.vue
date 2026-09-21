<template>
  <div
    class="model-reroute-status"
    :class="{ 'is-rerouted': reroute && !report, 'is-reported': report }"
    role="status"
    aria-live="polite"
    :title="report ? t('Latest server-declared Responses model attributed when only one turn was active. This does not verify the underlying weights.') : reroute ? t('Codex app-server reported a model reroute; response.model was not captured for this turn.') : t('No upstream response.model has been captured for this turn.')"
  >
    <span>{{ t('Selected') }} <strong>{{ reroute?.fromModel || selectedModel }}</strong></span>
    <span class="model-reroute-separator" aria-hidden="true">·</span>
    <span v-if="report">{{ t('Server response.model') }} <strong>{{ report.model }}</strong><span v-if="report.responseCount > 1"> ({{ t('latest of') }} {{ report.responseCount }})</span></span>
    <span v-else-if="reroute">↪ {{ t('Rerouted to') }} <strong>{{ reroute.toModel }}</strong> ({{ t('response.model not captured') }})</span>
    <span v-else>{{ t('response.model not captured') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../../composables/useUiLanguage'
import type { ModelReroute } from '../../modelReroute'
import type { UpstreamModelReport } from '../../upstreamModelReport'

defineProps<{
  selectedModel: string
  reroute: ModelReroute | null
  report: UpstreamModelReport | null
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

.model-reroute-status.is-reported strong {
  @apply text-emerald-700;
}

.model-reroute-separator {
  @apply text-zinc-400;
}
</style>
