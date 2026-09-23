<template>
  <section class="native-config">
    <header class="config-heading"><div><h2>{{ t('Configuration') }}</h2><p>{{ t('Configure permissions, web access, and agent responses for new chats.') }}</p></div><button class="config-reload" type="button" :disabled="loading" @click="load">{{ loading ? t('Loading…') : t('Reload') }}</button></header>
    <div class="config-toolbar"><div><strong>{{ t('Agent defaults') }}</strong><span>{{ t('Choose where these defaults are stored.') }}</span></div><ComposerDropdown :model-value="target" :options="targetOptions" :enable-search="targetOptions.length > 7" @update:model-value="value => target = value" /></div>
    <p class="config-path">{{ draft?.filePath || (target === USER_TARGET ? '~/.codex/config.toml' : '.codex/config.toml') }}</p>
    <div v-if="draft" class="config-list">
      <div v-for="row in rows" :key="row.key" class="config-row"><div class="config-copy"><strong>{{ row.title }}</strong><span>{{ row.description }}</span></div><div class="config-control"><button v-if="row.key === 'networkAccess'" class="config-toggle" type="button" :aria-pressed="draft.networkAccess" @click="update('networkAccess', !draft.networkAccess)"><span :class="{ on: draft.networkAccess }" /></button><ComposerDropdown v-else :model-value="String(draft[row.key])" :options="row.options" :enable-search="row.key === 'model' && row.options.length > 7" @update:model-value="value => update(row.key, value)" /></div></div>
    </div>
    <p v-if="error" class="config-status error">{{ error }}</p><p v-else-if="saving" class="config-status">{{ t('Saving…') }}</p><p v-else-if="saved" class="config-status success">{{ t('Saved. New chats use the updated defaults.') }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ComposerDropdown from './ComposerDropdown.vue'
import { getCodexNativeSettings, saveCodexNativeSettings, type CodexNativeSettings } from '../../api/codexGateway'
import { useUiLanguage } from '../../composables/useUiLanguage'
import type { ReasoningEffort } from '../../types/codex'
type Option={value:string;label:string}; type EditableKey='model'|'reasoningEffort'|'approvalPolicy'|'sandboxMode'|'networkAccess'|'webSearch'|'verbosity'|'reasoningSummary'
const USER_TARGET='__user__'
const props=defineProps<{cwd:string;models:string[];modelLabels?:Record<string,string>;modelReasoningEfforts:Record<string,ReasoningEffort[]>;projectOptions:Option[]}>()
const {t}=useUiLanguage(); const target=ref(props.cwd||USER_TARGET); const draft=ref<CodexNativeSettings|null>(null); const loading=ref(false),saving=ref(false),error=ref(''),saved=ref(false); let loadToken=0
const targetOptions=computed<Option[]>(()=>[{value:USER_TARGET,label:t('User defaults')},...props.projectOptions])
const options=(values:string[],labels:Record<string,string>={})=>[{value:'',label:t('Inherit / model default')},...values.map(value=>({value,label:labels[value]?t(labels[value]):value}))]
const modelOptions=computed(()=>{const values=[...props.models];const configured=draft.value?.model.trim()||'';if(configured&&!values.includes(configured))values.unshift(configured);return options(values).map(option=>option.value?{...option,label:props.modelLabels?.[option.value]?.trim()||option.value.replace(/^gpt/i,'GPT')}:option)})
const reasoningOptions=computed(()=>options(props.modelReasoningEfforts[draft.value?.model||'']??['minimal','low','medium','high','xhigh'],{minimal:'Minimal',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max',ultra:'Ultra'}))
const rows=computed<Array<{key:EditableKey;title:string;description:string;options:Option[]}>>(()=>[
 {key:'model',title:t('Default model'),description:t('Model used when a new chat does not choose another model.'),options:modelOptions.value},
 {key:'reasoningEffort',title:t('Reasoning effort'),description:t('Controls how much reasoning the selected model performs before answering.'),options:reasoningOptions.value},
 {key:'approvalPolicy',title:t('Approval policy'),description:t('Choose when Codex must ask before running commands or changing files.'),options:options(['untrusted','on-failure','on-request','never'],{untrusted:'Untrusted only','on-failure':'On failure','on-request':'On request',never:'Never'})},
 {key:'sandboxMode',title:t('Sandbox mode'),description:t('Limits which files and system resources commands may access.'),options:options(['read-only','workspace-write','danger-full-access'],{'read-only':'Read only','workspace-write':'Workspace write','danger-full-access':'Full access'})},
 {key:'networkAccess',title:t('Workspace network access'),description:t('Allow commands in workspace-write mode to access the network.'),options:[]},
 {key:'webSearch',title:t('Web search'),description:t('Choose whether Codex uses disabled, cached, or live web search.'),options:options(['disabled','cached','live'],{disabled:'Disabled',cached:'Cached',live:'Live'})},
 {key:'verbosity',title:t('Output detail'),description:t('Controls how concise or detailed new responses should be.'),options:options(['low','medium','high'],{low:'Concise',medium:'Model default',high:'Detailed'})},
 {key:'reasoningSummary',title:t('Reasoning summary'),description:t('Choose how Codex summarizes its reasoning progress.'),options:options(['auto','concise','detailed','none'],{auto:'Automatic',concise:'Concise',detailed:'Detailed',none:'Hidden'})},
])
async function load(){const token=++loadToken;loading.value=true;error.value='';saved.value=false;try{const next=await getCodexNativeSettings(target.value===USER_TARGET?'user':'project',target.value===USER_TARGET?undefined:target.value);if(token===loadToken)draft.value=next}catch(cause){if(token===loadToken)error.value=cause instanceof Error?cause.message:String(cause)}finally{if(token===loadToken)loading.value=false}}
async function update(key:EditableKey,value:string|boolean){if(!draft.value||saving.value)return;const previous={...draft.value};draft.value={...draft.value,[key]:value};saving.value=true;error.value='';saved.value=false;try{await saveCodexNativeSettings(draft.value);await load();saved.value=true}catch(cause){draft.value=previous;error.value=cause instanceof Error?cause.message:String(cause)}finally{saving.value=false}}
watch(target,()=>void load(),{immediate:true})
</script>
<style scoped>
@reference "tailwindcss";
.native-config{@apply mx-auto w-full max-w-4xl}.config-heading{@apply mb-8 flex items-start justify-between gap-4}.config-heading h2{@apply text-2xl font-semibold}.config-heading p,.config-toolbar span,.config-copy span{@apply mt-1 block text-sm text-zinc-500}.config-reload{@apply rounded-xl border border-zinc-200 bg-transparent px-4 py-2 text-sm hover:bg-zinc-100}.config-toolbar{@apply flex items-center justify-between gap-5}.config-toolbar strong,.config-copy strong{@apply block text-sm font-semibold}.config-path{@apply mb-5 mt-2 font-mono text-xs text-zinc-400}.config-list{@apply rounded-2xl border border-zinc-200 px-5}.config-row{@apply flex min-h-20 items-center justify-between gap-6 border-b border-zinc-200 py-4 last:border-b-0}.config-copy{@apply min-w-0 flex-1}.config-control{@apply shrink-0}.config-toggle{@apply relative h-7 w-12 rounded-full border-0 bg-zinc-300 p-1 transition}.config-toggle span{@apply block h-5 w-5 rounded-full bg-white shadow-sm transition}.config-toggle span.on{@apply translate-x-5 bg-[var(--codex-accent)]}.config-status{@apply mt-4 text-sm text-zinc-500}.config-status.error{@apply text-red-600}.config-status.success{@apply text-emerald-600}@media(max-width:640px){.config-row,.config-toolbar{@apply items-start}.config-row{@apply flex-col gap-3}.config-control{@apply w-full}.config-control :deep(.composer-dropdown-trigger){@apply w-full justify-between}}
</style>
