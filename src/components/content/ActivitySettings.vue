<template><section class="activity-page"><header><div><h2>{{ t('Activity') }}</h2><p>{{ t('Local Codex usage from your chat history.') }}</p></div><button type="button" :disabled="loading" @click="load">{{ loading?t('Loading…'):t('Reload') }}</button></header><div v-if="data" class="activity-summary"><div v-for="item in summaryItems" :key="item.label" class="activity-metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div></div><div v-else-if="error" class="activity-error"><strong>{{ t('Activity is unavailable') }}</strong><p>{{ error }}</p></div><div v-else class="activity-loading">{{ t('Loading activity…') }}</div></section></template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCodexActivitySummary, type CodexActivitySummary } from '../../api/codexGateway'
import { useUiLanguage } from '../../composables/useUiLanguage'
const { t } = useUiLanguage()
const data = ref<CodexActivitySummary | null>(null)
const error = ref('')
const loading = ref(false)
const compact = (value: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const summaryItems = computed(() => data.value ? [
  { label: t('Total chats'), value: data.value.totalChats.toLocaleString() },
  { label: t('Active days'), value: data.value.activeDays.toLocaleString() },
  { label: t('Tokens used'), value: compact(data.value.totalTokens) },
  { label: t('Archived'), value: data.value.archivedChats.toLocaleString() },
  { label: t('Most used model'), value: data.value.topModel || '—' },
  { label: t('Most used reasoning'), value: data.value.topReasoningEffort || '—' },
] : [])
async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await getCodexActivitySummary() }
  catch (cause) { data.value = null; error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { loading.value = false }
}
onMounted(load)
</script>
<style scoped>@reference "tailwindcss";.activity-page{@apply mx-auto w-full max-w-4xl}.activity-page header{@apply mb-7 flex items-start justify-between}.activity-page h2{@apply text-2xl font-semibold}.activity-page header p{@apply mt-1 text-sm text-zinc-500}.activity-page header button{@apply rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-100}.activity-summary{@apply grid grid-cols-2 border-y border-zinc-200}.activity-metric{@apply flex items-baseline justify-between gap-4 border-b border-zinc-200 px-1 py-5 odd:mr-6 even:ml-6}.activity-metric:nth-last-child(-n+2){@apply border-b-0}.activity-metric span{@apply text-sm text-zinc-500}.activity-metric strong{@apply max-w-[60%] truncate text-xl font-semibold}.activity-error{@apply rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800}.activity-error p{@apply mt-1 text-sm}.activity-loading{@apply border-y border-zinc-200 py-8 text-sm text-zinc-500}@media(max-width:640px){.activity-summary{@apply grid-cols-1}.activity-metric{@apply mx-0!}.activity-metric:nth-last-child(2){@apply border-b}.activity-metric strong{@apply text-lg}}</style>
