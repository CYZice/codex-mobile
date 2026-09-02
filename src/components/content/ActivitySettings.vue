<template><section class="activity"><header><div><h2>Activity</h2><p>Local Codex usage from your chat history.</p></div><button @click="load">Reload</button></header><p v-if="error" class="error">{{ error }}</p><div v-else-if="data" class="stats"><article><strong>{{ data.totalChats }}</strong><span>Total chats</span></article><article><strong>{{ data.activeDays }}</strong><span>Active days</span></article><article><strong>{{ format(data.totalTokens) }}</strong><span>Tokens used</span></article><article><strong>{{ data.archivedChats }}</strong><span>Archived</span></article><article><strong>{{ data.topModel || '—' }}</strong><span>Most used model</span></article><article><strong>{{ data.topReasoningEffort || '—' }}</strong><span>Most used reasoning</span></article></div><p v-else>Loading…</p></section></template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getCodexActivitySummary, type CodexActivitySummary } from '../../api/codexGateway'
const data = ref<CodexActivitySummary | null>(null)
const error = ref('')
const format = (value: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
async function load() {
  error.value = ''
  try { data.value = await getCodexActivitySummary() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}
onMounted(load)
</script>
<style scoped>@reference "tailwindcss";.activity{@apply rounded-xl border border-zinc-200 bg-white p-6}.activity header{@apply mb-5 flex justify-between}.activity h2{@apply text-xl font-semibold}.activity p,.activity span{@apply text-sm text-zinc-500}.activity button{@apply rounded-lg border border-zinc-200 px-3 py-2}.stats{@apply grid grid-cols-2 gap-3}.stats article{@apply flex flex-col rounded-xl bg-zinc-50 p-4}.stats strong{@apply truncate text-2xl}.error{@apply text-red-600!}:global(.dark) .activity{@apply border-zinc-800 bg-zinc-900}:global(.dark) .stats article{@apply bg-zinc-800}</style>
