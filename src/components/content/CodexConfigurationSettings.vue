<template>
  <section class="native-config">
    <header><div><h2>Agent defaults</h2><p>Codex config.toml settings for new chats.</p></div><button :disabled="loading" @click="load">{{ loading ? 'Loading…' : 'Reload' }}</button></header>
    <div class="scope-tabs" role="tablist">
      <button v-for="item in scopes" :key="item.value" :class="{ active: scope === item.value }" @click="scope = item.value">{{ item.label }}</button>
    </div>
    <p v-if="scope === 'project' && !cwd" class="notice">Open a project to edit Project config.</p>
    <template v-else>
      <p class="path">{{ draft?.filePath || (scope === 'user' ? '~/.codex/config.toml' : '.codex/config.toml') }}</p>
      <div v-if="draft" class="config-grid">
        <label>Default model<input v-model="draft.model" placeholder="Use Codex default"></label>
        <label>Reasoning effort<ComposerDropdown v-model="draft.reasoningEffort" :options="reasoningOptions" /></label>
        <label>Approval policy<ComposerDropdown v-model="draft.approvalPolicy" :options="approvalOptions" /></label>
        <label>Sandbox mode<ComposerDropdown v-model="draft.sandboxMode" :options="sandboxOptions" /></label>
        <label>Web search<ComposerDropdown v-model="draft.webSearch" :options="webOptions" /></label>
        <label>Output detail<ComposerDropdown v-model="draft.verbosity" :options="verbosityOptions" /></label>
        <label>Reasoning summary<ComposerDropdown v-model="draft.reasoningSummary" :options="summaryOptions" /></label>
        <button class="toggle-row" @click="draft.networkAccess = !draft.networkAccess"><span>Workspace network access</span><span class="toggle" :class="{ on: draft.networkAccess }" /></button>
      </div>
      <p v-if="error" class="error">{{ error }}</p><p v-if="saved" class="success">Saved. New chats use the updated defaults.</p>
      <button class="save" :disabled="!draft || saving" @click="save">{{ saving ? 'Saving…' : 'Save config' }}</button>
    </template>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import ComposerDropdown from './ComposerDropdown.vue'
import { getCodexNativeSettings, saveCodexNativeSettings, type CodexNativeSettings, type CodexSettingsScope } from '../../api/codexGateway'
const props = defineProps<{ cwd: string }>()
const scope = ref<CodexSettingsScope>('user'), draft = ref<CodexNativeSettings | null>(null), loading = ref(false), saving = ref(false), error = ref(''), saved = ref(false)
const scopes = [{value:'user' as const,label:'User config'},{value:'project' as const,label:'Project config'}]
const option = (values:string[]) => [{value:'',label:'Inherit / default'}, ...values.map(value=>({value,label:value}))]
const reasoningOptions=option(['minimal','low','medium','high','xhigh']), approvalOptions=option(['untrusted','on-failure','on-request','never']), sandboxOptions=option(['read-only','workspace-write','danger-full-access']), webOptions=option(['disabled','cached','live']), verbosityOptions=option(['low','medium','high']), summaryOptions=option(['auto','concise','detailed','none'])
async function load(){ if(scope.value==='project'&&!props.cwd){draft.value=null;return} loading.value=true;error.value='';saved.value=false;try{draft.value=await getCodexNativeSettings(scope.value,props.cwd)}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{loading.value=false}}
async function save(){if(!draft.value)return;saving.value=true;error.value='';saved.value=false;try{await saveCodexNativeSettings(draft.value);saved.value=true;await load();saved.value=true}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{saving.value=false}}
watch([scope,()=>props.cwd],()=>void load(),{immediate:true})
</script>
<style scoped>
@reference "tailwindcss";
.native-config{@apply rounded-xl border border-zinc-200 bg-white p-6}.native-config header{@apply mb-5 flex items-start justify-between}.native-config h2{@apply text-xl font-semibold}.native-config p{@apply text-sm text-zinc-500}.native-config button{@apply rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm}.scope-tabs{@apply mb-4 flex gap-2}.scope-tabs .active{@apply bg-zinc-900 text-white}.path{@apply mb-4 font-mono text-xs}.config-grid{@apply grid grid-cols-2 gap-4}.config-grid label{@apply flex flex-col gap-2 text-sm font-medium}.config-grid input{@apply rounded-lg border border-zinc-200 px-3 py-2 font-normal}.toggle-row{@apply col-span-2 flex items-center justify-between}.toggle{@apply h-5 w-9 rounded-full bg-zinc-300}.toggle.on{@apply bg-emerald-500}.save{@apply mt-5 bg-zinc-900! text-white}.error{@apply mt-4 text-red-600!}.success{@apply mt-4 text-emerald-600!}.notice{@apply rounded-lg bg-amber-50 p-3 text-amber-800!}:global(.dark) .native-config{@apply border-zinc-800 bg-zinc-900}:global(.dark) .native-config button,:global(.dark) .config-grid input{@apply border-zinc-700 bg-zinc-800 text-zinc-100}@media(max-width:700px){.config-grid{@apply grid-cols-1}.toggle-row{@apply col-span-1}}
</style>
