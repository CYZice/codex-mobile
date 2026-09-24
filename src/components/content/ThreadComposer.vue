<template>
  <Teleport to="body" :disabled="!isComposerExpanded">
    <form
      class="thread-composer"
      :class="{ 'thread-composer--expanded': isComposerExpanded }"
      @submit.prevent="onSubmit(isTurnInProgress ? activeInProgressMode : 'steer')"
    >
    <p v-if="dictationErrorText" class="thread-composer-dictation-error">
      {{ dictationErrorText }}
    </p>

    <div
      class="thread-composer-shell"
      :class="{
        'thread-composer-shell--no-top-radius': hasQueueAbove,
        'thread-composer-shell--drag-active': isDragActive,
      }"
    >
      <div v-if="hasDraftContext" class="thread-composer-draft-context">
      <div v-if="selectedImages.length > 0" class="thread-composer-attachments">
        <div v-for="image in selectedImages" :key="image.id" class="thread-composer-attachment">
          <img class="thread-composer-attachment-image" :src="image.url" :alt="image.name || 'Selected image'" />
          <button
            class="thread-composer-attachment-remove"
            type="button"
            :aria-label="`Remove ${image.name || 'image'}`"
            :disabled="isInteractionDisabled"
            @click="removeImage(image.id)"
          >
            x
          </button>
        </div>
      </div>

      <div v-if="folderUploadGroups.length > 0" class="thread-composer-folder-chips">
        <span v-for="group in folderUploadGroups" :key="group.id" class="thread-composer-folder-chip">
          <IconTablerFolder class="thread-composer-folder-chip-icon" />
          <span class="thread-composer-folder-chip-name" :title="group.name">{{ group.name }}</span>
          <span class="thread-composer-folder-chip-meta">
            <template v-if="group.isUploading">
              {{ getFolderUploadPercent(group) }}% uploading ({{ group.processed }}/{{ group.total }})
            </template>
            <template v-else>
              {{ group.filePaths.length }} file{{ group.filePaths.length === 1 ? '' : 's' }}
            </template>
          </span>
          <button
            class="thread-composer-folder-chip-remove"
            type="button"
            :aria-label="`Remove folder ${group.name}`"
            :disabled="isInteractionDisabled"
            @click="removeFolderAttachment(group.id)"
          >×</button>
        </span>
      </div>

      <div v-if="standaloneFileAttachments.length > 0" class="thread-composer-file-chips">
        <span v-for="att in standaloneFileAttachments" :key="att.fsPath" class="thread-composer-file-chip">
          <IconTablerFilePencil class="thread-composer-file-chip-icon" />
          <span class="thread-composer-file-chip-name" :title="att.fsPath">{{ att.label }}</span>
          <button
            class="thread-composer-file-chip-remove"
            type="button"
            :aria-label="`Remove ${att.label}`"
            :disabled="isInteractionDisabled"
            @click="removeFileAttachment(att.fsPath)"
          >×</button>
        </span>
      </div>

      <div v-if="selectedSkills.length > 0" class="thread-composer-skill-chips">
        <span v-for="skill in selectedSkills" :key="skill.path" class="thread-composer-skill-chip">
          <button
            class="thread-composer-skill-chip-name"
            type="button"
            :title="skillMarkdownPath(skill.path)"
            :aria-label="`Open ${skill.displayName || skill.name} SKILL.md`"
            @click="openSkillMarkdown(skill)"
          >
            {{ skill.displayName || skill.name }}
          </button>
          <button
            class="thread-composer-skill-chip-remove"
            type="button"
            :aria-label="`Remove skill ${skill.displayName || skill.name}`"
            :disabled="isInteractionDisabled"
            @click="removeSkill(skill.path)"
          >×</button>
        </span>
      </div>

      </div>

      <ComposerSkillPicker
        :skills="matchingSkills"
        :visible="isSkillPickerOpen"
        :highlighted-index="skillHighlightedIndex"
        @select="applySkillMention"
        @highlight="skillHighlightedIndex = $event"
      />

      <div
        class="thread-composer-input-wrap"
        :class="{
          'thread-composer-input-wrap--drag-active': isDragActive,
          'thread-composer-input-wrap--expanded': isComposerExpanded,
        }"
        @dragenter="onInputDragEnter"
        @dragover="onInputDragOver"
        @dragleave="onInputDragLeave"
        @drop="onInputDrop"
      >
        <div v-if="isDragActive" class="thread-composer-drop-overlay" aria-hidden="true">
          <span class="thread-composer-drop-overlay-copy">Drop images or files</span>
        </div>
        <div v-if="isSlashCommandOpen" class="thread-composer-slash-commands" role="listbox" aria-label="Composer commands">
          <button
            v-for="(command, index) in slashCommandSuggestions"
            :key="command.name"
            class="thread-composer-slash-command-row"
            :class="{ 'is-active': index === slashCommandHighlightedIndex }"
            type="button"
            role="option"
            :aria-selected="index === slashCommandHighlightedIndex"
            @mousedown.prevent="executeSuggestedCommand(command.name)"
          >
            <span class="thread-composer-slash-command-name">/{{ command.name }}</span>
            <span class="thread-composer-slash-command-description">{{ command.description }}</span>
          </button>
        </div>
        <div v-if="isReviewChoiceOpen" class="thread-composer-review-choices" role="group" aria-label="Review scope">
          <div class="thread-composer-review-heading">
            <strong>{{ t('Choose review scope') }}</strong>
            <button type="button" :aria-label="t('Cancel review')" @click="closeReviewChoices">×</button>
          </div>
          <button type="button" class="thread-composer-review-choice" :disabled="isInteractionDisabled || isTurnInProgress" @click="submitReviewTarget({ type: 'uncommittedChanges' })">
            {{ t('Uncommitted changes') }}
          </button>
          <div class="thread-composer-review-choice">
            <label for="composer-review-branch">{{ t('Compare against branch') }}</label>
            <input id="composer-review-branch" v-model="reviewBranch" :list="reviewBranchListId" :placeholder="t('Branch name')" autocomplete="off" :disabled="isInteractionDisabled || isTurnInProgress" @keydown.enter.prevent="reviewBranch.trim() && submitReviewTarget({ type: 'baseBranch', branch: reviewBranch })" />
            <datalist :id="reviewBranchListId"><option v-for="branch in (reviewBranches ?? [])" :key="branch.value" :value="branch.value" /></datalist>
            <button type="button" :disabled="isInteractionDisabled || isTurnInProgress || !reviewBranch.trim()" @click="submitReviewTarget({ type: 'baseBranch', branch: reviewBranch })">{{ t('Review branch') }}</button>
          </div>
          <div class="thread-composer-review-choice">
            <label for="composer-review-commit">{{ t('Review a commit') }}</label>
            <input id="composer-review-commit" v-model="reviewCommit" :placeholder="t('Commit SHA')" autocomplete="off" :disabled="isInteractionDisabled || isTurnInProgress" @keydown.enter.prevent="/^[a-f0-9]{7,64}$/i.test(reviewCommit.trim()) && submitReviewTarget({ type: 'commit', sha: reviewCommit })" />
            <button type="button" :disabled="isInteractionDisabled || isTurnInProgress || !/^[a-f0-9]{7,64}$/i.test(reviewCommit.trim())" @click="submitReviewTarget({ type: 'commit', sha: reviewCommit })">{{ t('Review commit') }}</button>
          </div>
        </div>
        <div v-if="isFileMentionOpen && !isAttachMenuOpen" class="thread-composer-file-mentions">
          <template v-if="fileMentionSuggestions.length > 0">
            <button
              v-for="(item, index) in fileMentionSuggestions"
              :key="item.path"
              class="thread-composer-file-mention-row"
              :class="{ 'is-active': index === fileMentionHighlightedIndex }"
              type="button"
              @mousedown.prevent="applyFileMention(item)"
            >
              <span
                v-if="getMentionBadgeText(item.path)"
                class="thread-composer-file-mention-icon-badge"
                :class="`is-${getMentionBadgeClass(item.path)}`"
              >
                {{ getMentionBadgeText(item.path) }}
              </span>
              <span v-else-if="isMarkdownFile(item.path)" class="thread-composer-file-mention-icon-markdown">↓</span>
              <IconTablerFilePencil v-else class="thread-composer-file-mention-icon-file" />
              <span class="thread-composer-file-mention-text">
                <span class="thread-composer-file-mention-name">{{ getMentionFileName(item.path) }}</span>
                <span v-if="getMentionDirName(item.path)" class="thread-composer-file-mention-dir">{{ getMentionDirName(item.path) }}</span>
              </span>
            </button>
          </template>
          <div v-else class="thread-composer-file-mention-empty">{{ t('No matching files') }}</div>
        </div>
        <ComposerRichInput
          ref="inputRef"
          v-model="draft"
          :placeholder="placeholderText"
          :disabled="isInteractionDisabled"
          @input="onInputChange"
          @keydown="onInputKeydown"
          @paste="onInputPaste"
          @references-change="onComposerReferencesChange"
        />
        <button
          v-if="hasExpandedComposerToggle"
          class="thread-composer-expand"
          type="button"
          :aria-label="isComposerExpanded ? t('Exit full screen composer') : t('Expand composer')"
          :title="isComposerExpanded ? t('Exit full screen composer') : t('Expand composer')"
          :disabled="isInteractionDisabled"
          @click="toggleComposerExpanded"
        >
          <IconTablerMinimize v-if="isComposerExpanded" class="thread-composer-expand-icon" />
          <IconTablerMaximize v-else class="thread-composer-expand-icon" />
        </button>
      </div>

      <div
        class="thread-composer-controls"
        :class="{ 'thread-composer-controls--recording': isDictationRecording }"
      >
        <div ref="attachMenuRootRef" class="thread-composer-attach">
          <button
            class="thread-composer-attach-trigger"
            type="button"
            :aria-label="t('Add photos & files')"
            :disabled="isInteractionDisabled"
            @click="toggleAttachMenu"
          >
            +
          </button>

          <div v-if="isAttachMenuOpen" class="thread-composer-attach-menu composer-menu-surface composer-menu-scroll">
            <div class="thread-composer-attach-section-label">{{ t('Add') }}</div>
            <button
              class="thread-composer-attach-item"
              type="button"
              :disabled="isInteractionDisabled"
              v-if="!isUnifiedAttachMenu || matchesMentionQuery('Add photos & files', 'photos', 'files', 'image')"
              @click="triggerPhotoLibrary"
            >
              {{ t('Add photos & files') }}
            </button>
            <button
              class="thread-composer-attach-item"
              type="button"
              :disabled="isInteractionDisabled"
              v-if="!isUnifiedAttachMenu || matchesMentionQuery('Add folder', 'folder')"
              @click="triggerFolderPicker"
            >
              {{ t('Add folder') }}
            </button>
            <button
              class="thread-composer-attach-item"
              type="button"
              :disabled="isInteractionDisabled"
              v-if="!isUnifiedAttachMenu || matchesMentionQuery('Take photo', 'photo', 'camera')"
              @click="triggerCameraCapture"
            >
              {{ t('Take photo') }}
            </button>
            <button
              class="thread-composer-attach-item thread-composer-attach-plan-item"
              type="button"
              :disabled="isComposerConfigDisabled"
              v-if="!isUnifiedAttachMenu || matchesMentionQuery('Plan mode', 'plan')"
              @click="togglePlanModeFromAttachMenu"
            >
              <IconTablerBulb class="thread-composer-attach-plan-icon" />
              <span class="thread-composer-attach-plan-copy">
                <span>{{ t('Plan mode') }}</span>
                <small>{{ t('Agent proposes a plan before acting') }}</small>
              </span>
            </button>
            <template v-if="isLoadingComposerPlugins || composerPluginsError || visibleComposerPlugins.length > 0">
              <div class="thread-composer-attach-separator" />
              <div class="thread-composer-attach-section-label">{{ t('Plugins') }}</div>
              <div v-if="isLoadingComposerPlugins" class="thread-composer-attach-loading">{{ t('Loading plugins...') }}</div>
              <div v-else-if="composerPluginsError" class="thread-composer-attach-error" role="status">
                <span>{{ composerPluginsError }}</span>
                <button type="button" :disabled="isInteractionDisabled" @click="() => loadComposerPlugins({ force: true })">
                  {{ t('Retry') }}
                </button>
              </div>
              <button
                v-for="plugin in visibleComposerPlugins"
                :key="plugin.id"
                class="thread-composer-attach-plugin"
                type="button"
                :disabled="isInteractionDisabled"
                @click="selectComposerPlugin(plugin)"
              >
                <img
                  v-if="pluginIconSrc(plugin)"
                  class="thread-composer-attach-plugin-icon"
                  :src="pluginIconSrc(plugin)"
                  alt=""
                />
                <span v-else class="thread-composer-attach-plugin-icon is-fallback">{{ plugin.displayName.slice(0, 1) }}</span>
                <span class="thread-composer-attach-plugin-copy">
                  <span class="thread-composer-attach-plugin-name">{{ plugin.displayName }}</span>
                  <span v-if="plugin.description" class="thread-composer-attach-plugin-description">{{ plugin.description }}</span>
                </span>
              </button>
            </template>
            <template v-if="isLoadingChatGptConversations || chatGptConversationsError || visibleChatGptConversations.length > 0">
              <div class="thread-composer-attach-separator" />
              <div class="thread-composer-attach-section-label">{{ t('ChatGPT conversations') }}</div>
              <div v-if="isLoadingChatGptConversations" class="thread-composer-attach-loading">{{ t('Loading ChatGPT conversations...') }}</div>
              <div v-else-if="chatGptConversationsError" class="thread-composer-attach-error" role="status">
                <span>{{ chatGptConversationsError }}</span>
                <button type="button" :disabled="isInteractionDisabled" @click="() => loadChatGptConversations()">
                  {{ t('Retry') }}
                </button>
              </div>
              <button
                v-for="conversation in visibleChatGptConversations"
                :key="conversation.conversationId"
                class="thread-composer-attach-plugin"
                type="button"
                :disabled="isInteractionDisabled || Boolean(chatGptConversationLoadingId)"
                @click="selectChatGptConversation(conversation)"
              >
                <span class="thread-composer-attach-plugin-icon is-chatgpt" aria-hidden="true">○</span>
                <span class="thread-composer-attach-plugin-copy">
                  <span class="thread-composer-attach-plugin-name">{{ conversation.title }}</span>
                  <span class="thread-composer-attach-plugin-description">{{ t('ChatGPT conversation') }}</span>
                </span>
              </button>
              <button
                v-if="chatGptNextOffset !== null && !isLoadingChatGptConversations"
                class="thread-composer-attach-item"
                type="button"
                :disabled="isInteractionDisabled"
                @click="() => loadChatGptConversations({ more: true })"
              >
                {{ t('Load more') }}
              </button>
            </template>
            <template v-if="isUnifiedAttachMenu && fileMentionSuggestions.length > 0">
              <div class="thread-composer-attach-separator" />
              <div class="thread-composer-attach-section-label">{{ t('Files') }}</div>
              <button
                v-for="item in fileMentionSuggestions"
                :key="`mention-file-${item.path}`"
                class="thread-composer-attach-plugin"
                type="button"
                :disabled="isInteractionDisabled"
                @click="applyFileMention(item)"
              >
                <IconTablerFilePencil class="thread-composer-attach-plugin-icon is-file" />
                <span class="thread-composer-attach-plugin-copy">
                  <span class="thread-composer-attach-plugin-name">{{ getMentionFileName(item.path) }}</span>
                  <span class="thread-composer-attach-plugin-description">{{ getMentionDirName(item.path) }}</span>
                </span>
              </button>
            </template>
            <div class="thread-composer-attach-separator" />
            <button
              v-if="isFastModeSupported && (!isUnifiedAttachMenu || matchesMentionQuery('Fast mode', 'fast'))"
              class="thread-composer-attach-setting"
              type="button"
              role="switch"
              :aria-checked="selectedSpeedMode === 'fast'"
              :aria-label="`${t('Fast mode')} ${selectedSpeedMode === 'fast' ? t('enabled') : t('disabled')}`"
              :disabled="isSpeedToggleDisabled"
              @click="onToggleSpeedMode"
            >
              <span class="thread-composer-attach-setting-copy">
                <span class="thread-composer-attach-setting-label">{{ t('Fast mode') }}</span>
                <span class="thread-composer-attach-setting-description">{{ speedModeDescription }}</span>
              </span>
              <span
                class="thread-composer-attach-switch"
                :class="{
                  'is-on': selectedSpeedMode === 'fast',
                  'is-busy': isUpdatingSpeedMode,
                  'is-disabled': isSpeedToggleDisabled,
                }"
              />
            </button>
          </div>
        </div>

        <PermissionsDropdown
          v-if="!isMobile && !isDictationRecording"
          class="thread-composer-desktop-permissions"
          :model-value="selectedPermissionPreset"
          :disabled="isComposerConfigDisabled"
          :is-turn-in-progress="isTurnInProgress"
          @select="onPermissionPresetSelected"
        />

        <div v-if="!isMobile && !isDictationRecording && isPlanModeSelected" class="thread-composer-config-controls">
          <button
            class="thread-composer-plan-toggle"
            type="button"
            :aria-label="t('Disable plan mode')"
            :disabled="isComposerConfigDisabled"
            @click="toggleCollaborationMode"
          >
            <IconTablerBulb class="thread-composer-plan-toggle-icon" />
            <span>{{ t('Plan') }}</span>
          </button>
        </div>

        <div v-if="!isDictationRecording" class="thread-composer-model-context">
          <div v-if="isMobile" class="thread-composer-mobile-leading-controls">
            <PermissionsDropdown
              class="thread-composer-mobile-permissions thread-composer-control"
              :model-value="selectedPermissionPreset"
              :disabled="isComposerConfigDisabled"
              :is-turn-in-progress="isTurnInProgress"
              @select="onPermissionPresetSelected"
            />
            <button
              v-if="isPlanModeSelected"
              class="thread-composer-plan-toggle"
              type="button"
              :aria-label="t('Disable plan mode')"
              :disabled="isComposerConfigDisabled"
              @click="toggleCollaborationMode"
            >
              <IconTablerBulb class="thread-composer-plan-toggle-icon" />
              <span>{{ t('Plan') }}</span>
            </button>
          </div>
          <div
            v-if="contextUsageView"
            class="thread-composer-context-ring"
            :class="`is-${contextUsageTone}`"
            :style="{ '--context-usage-percent': String(contextUsageUsedPercent) }"
            tabindex="0"
            :aria-label="`${t('Context window')}: ${contextUsageUsedPercent}% ${t('used')}`"
            :title="`${contextUsageUsedPercent}% ${t('used')} · ${contextUsageRemainingPercent}% ${t('left')}`"
          >
            <span class="thread-composer-context-ring-track" aria-hidden="true" />
            <div class="thread-composer-context-tooltip" role="tooltip">
              <span class="thread-composer-context-tooltip-label">{{ t('Context window') }}</span>
              <strong>{{ contextUsageUsedPercent }}% {{ t('used') }} · {{ contextUsageRemainingPercent }}% {{ t('left') }}</strong>
              <span>{{ t('Used') }} {{ formatCompactTokenCount(contextTokensInUse) }} {{ t('tokens of') }} {{ formatCompactTokenCount(contextWindowTokens) }}</span>
            </div>
          </div>
          <ModelSettingsDropdown
            class="thread-composer-control"
            :model-value="selectedModel"
            :model-options="modelOptions"
            :reasoning-value="selectedReasoningEffort"
            :reasoning-options="reasoningOptions"
            :placeholder="t('Model')"
            :model-label="t('Model')"
            :thinking-label="t('Thinking')"
            :disabled="isComposerConfigDisabled || models.length === 0"
            @update:model-value="onModelSelect"
            @update:reasoning-value="onReasoningEffortSelect"
          />
        </div>

        <div
          class="thread-composer-actions"
          :class="{ 'thread-composer-actions--recording': isDictationRecording }"
        >
          <div v-if="dictationState === 'recording'" class="thread-composer-dictation-waveform-wrap" aria-hidden="true">
            <canvas ref="dictationWaveformCanvasRef" class="thread-composer-dictation-waveform" />
          </div>

          <span v-if="dictationState === 'recording'" class="thread-composer-dictation-timer">
            {{ dictationDurationLabel }}
          </span>

          <button
            v-if="isDictationSupported"
            class="thread-composer-mic"
            :class="{
              'thread-composer-mic--active': dictationState === 'recording',
            }"
            type="button"
            :aria-label="dictationButtonLabel"
            :title="dictationButtonLabel"
            :disabled="isInteractionDisabled"
            @click="onDictationToggle"
            @pointerdown="onDictationPressStart"
            @pointerup="onDictationPressEnd"
            @pointercancel="onDictationPressEnd"
          >
            <IconTablerPlayerStopFilled
              v-if="dictationState === 'recording'"
              class="thread-composer-mic-icon thread-composer-mic-icon--stop"
            />
            <IconTablerMicrophone v-else class="thread-composer-mic-icon" />
          </button>

          <button
            v-if="isTurnInProgress && !hasSubmitContent"
            class="thread-composer-stop"
            type="button"
            :aria-label="isStopPending ? t('Saving thread before stop is available') : t('Stop')"
            :title="isStopPending ? t('Saving thread before stop is available') : t('Stop')"
            :disabled="disabled || !activeThreadId || isInterruptingTurn || isStopPending"
            @click="onInterrupt"
          >
            <span v-if="isStopPending" class="thread-composer-stop-spinner" aria-hidden="true" />
            <IconTablerPlayerStopFilled v-else class="thread-composer-stop-icon" />
          </button>
          <button
            v-else
            class="thread-composer-submit"
            :class="{ 'thread-composer-submit--queue': isTurnInProgress && activeInProgressMode === 'queue' }"
            type="button"
            :aria-label="isSubmitting ? t('Sending message') : (isTurnInProgress && activeInProgressMode === 'queue' ? t('Queue message') : t('Send message'))"
            :title="isSubmitting ? t('Sending message') : (isTurnInProgress ? `${t('Send')} ${activeInProgressMode === 'queue' ? t('Queue') : t('Steer')}` : t('Send'))"
            :disabled="!canSubmit"
            @click="onSubmit(isTurnInProgress ? activeInProgressMode : 'steer')"
          >
            <span v-if="isSubmitting" class="thread-composer-stop-spinner" aria-hidden="true" />
            <IconTablerArrowUp v-else class="thread-composer-submit-icon" />
          </button>
        </div>
      </div>

    </div>
    <p v-if="!dictationErrorText && attachmentFeedbackText" class="thread-composer-attachment-feedback">
      {{ attachmentFeedbackText }}
    </p>
    <input
      ref="photoLibraryInputRef"
      class="thread-composer-hidden-input"
      type="file"
      multiple
      :disabled="isInteractionDisabled"
      @change="onPhotoLibraryChange"
    />
    <input
      ref="cameraCaptureInputRef"
      class="thread-composer-hidden-input"
      type="file"
      accept="image/*"
      capture="environment"
      :disabled="isInteractionDisabled"
      @change="onCameraCaptureChange"
    />
    <input
      ref="folderPickerInputRef"
      class="thread-composer-hidden-input"
      type="file"
      multiple
      webkitdirectory
      directory
      :disabled="isInteractionDisabled"
      @change="onFolderPickerChange"
    />
    <FullAccessConfirmation
      :open="isFullAccessConfirmationOpen"
      @cancel="isFullAccessConfirmationOpen = false"
      @confirm="confirmFullAccess"
    />
    </form>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FALLBACK_REASONING_EFFORTS } from '../../types/codex'
import type {
  CollaborationModeKind,
  CollaborationModeOption,
  ReasoningEffort,
  SpeedMode,
  UiRateLimitSnapshot,
  UiRateLimitWindow,
  UiThreadTokenUsage,
} from '../../types/codex'
import { useDictation } from '../../composables/useDictation'
import { useMobile } from '../../composables/useMobile'
import { useUiLanguage } from '../../composables/useUiLanguage'
import type { PermissionPreset } from '../../permissions'
import { getComposerCommandQuery, parseComposerCommand, type ComposerCommand, type ComposerCommandName, type ReviewCommandTarget } from '../../composerCommands'
import {
  getChatGptConversationPreview,
  listChatGptConversations,
  listDirectoryPlugins,
  searchComposerFiles,
  uploadFile,
  type ComposerFileSuggestion,
  type ChatGptConversationPreview,
  type ChatGptConversationPage,
  type ChatGptConversationSummary,
  type DirectoryPluginSummary,
} from '../../api/codexGateway'
import IconTablerArrowUp from '../icons/IconTablerArrowUp.vue'
import IconTablerBolt from '../icons/IconTablerBolt.vue'
import IconTablerBulb from '../icons/IconTablerBulb.vue'
import IconTablerFilePencil from '../icons/IconTablerFilePencil.vue'
import IconTablerFolder from '../icons/IconTablerFolder.vue'
import IconTablerMaximize from '../icons/IconTablerMaximize.vue'
import IconTablerMicrophone from '../icons/IconTablerMicrophone.vue'
import IconTablerMinimize from '../icons/IconTablerMinimize.vue'
import IconTablerPlayerStopFilled from '../icons/IconTablerPlayerStopFilled.vue'
import ComposerSkillPicker from './ComposerSkillPicker.vue'
import ComposerRichInput, {
  type ComposerInlineReference,
  type ComposerRichInputExposed,
  type ComposerSelectionContext,
} from './ComposerRichInput.vue'
import { buildChatGptConversationReferenceBlock, composerReferenceHref } from '../../composerReferences'
import FullAccessConfirmation from './FullAccessConfirmation.vue'
import ModelSettingsDropdown from './ModelSettingsDropdown.vue'
import PermissionsDropdown from './PermissionsDropdown.vue'

type SkillItem = { name: string; displayName?: string; description: string; path: string; scope?: string; enabled?: boolean }

const props = defineProps<{
  activeThreadId: string
  cwd?: string
  reviewBranches?: Array<{ value: string; label: string; isCurrent?: boolean }>
  collaborationModes?: CollaborationModeOption[]
  selectedCollaborationMode: CollaborationModeKind
  selectedPermissionPreset: PermissionPreset
  models: string[]
  modelLabels?: Record<string, string>
  modelReasoningEfforts?: Record<string, ReasoningEffort[]>
  selectedModel: string
  selectedReasoningEffort: ReasoningEffort | ''
  selectedSpeedMode: SpeedMode
  skills?: SkillItem[]
  threadTokenUsage?: UiThreadTokenUsage | null
  codexQuota?: UiRateLimitSnapshot | null
  isTurnInProgress?: boolean
  isStopPending?: boolean
  isInterruptingTurn?: boolean
  isUpdatingSpeedMode?: boolean
  isSubmitting?: boolean
  disabled?: boolean
  hasQueueAbove?: boolean
  sendWithEnter?: boolean
  inProgressSubmitMode?: 'steer' | 'queue'
  dictationClickToToggle?: boolean
  dictationAutoSend?: boolean
  dictationLanguage?: string
}>()

export type FileAttachment = { label: string; path: string; fsPath: string }

export type ComposerDraftPayload = {
  text: string
  imageUrls: string[]
  fileAttachments: FileAttachment[]
  skills: Array<{ name: string; path: string }>
}

export type SubmitPayload = {
  text: string
  imageUrls: string[]
  fileAttachments: FileAttachment[]
  skills: Array<{ name: string; path: string }>
  mode: 'steer' | 'queue'
}

export type ComposerCommandPayload = {
  command: ComposerCommand
  submission: SubmitPayload
}

export type ThreadComposerExposed = {
  hydrateDraft: (payload: ComposerDraftPayload) => void
  appendTextToDraft: (text: string) => void
  focusInput: () => void
  hasUnsavedDraft: () => boolean
  completeSubmission: () => void
}

const emit = defineEmits<{
  submit: [payload: SubmitPayload]
  'execute-command': [payload: ComposerCommandPayload]
  interrupt: []
  'update:selected-collaboration-mode': [mode: CollaborationModeKind]
  'update:selected-permission-preset': [preset: PermissionPreset]
  'update:selected-model': [modelId: string]
  'update:selected-reasoning-effort': [effort: ReasoningEffort | '']
  'update:selected-speed-mode': [mode: SpeedMode]
}>()
const { t } = useUiLanguage()
const isFullAccessConfirmationOpen = ref(false)

type SelectedImage = {
  id: string
  name: string
  url: string
}

type FolderUploadGroup = {
  id: string
  name: string
  total: number
  processed: number
  filePaths: string[]
  isUploading: boolean
}

type AttachmentBatchStats = {
  total: number
  succeeded: number
  failed: number
}

const PASTED_TEXT_FILE_THRESHOLD = 2000
const draft = ref('')
const selectedImages = ref<SelectedImage[]>([])
const selectedSkills = ref<SkillItem[]>([])
const selectedComposerPlugins = ref<DirectoryPluginSummary[]>([])
const selectedChatGptConversations = ref<ChatGptConversationPreview[]>([])
const fileAttachments = ref<FileAttachment[]>([])
const folderUploadGroups = ref<FolderUploadGroup[]>([])

const dictationFeedback = ref('')
const pendingAttachmentCount = ref(0)
const attachmentBatchStats = ref<AttachmentBatchStats | null>(null)
const isDragActive = ref(false)
const {
  state: dictationState,
  isSupported: isDictationSupported,
  recordingDurationMs,
  waveformCanvasRef: dictationWaveformCanvasRef,
  startRecording,
  stopRecording,
  toggleRecording,
  cancel: cancelDictation,
} = useDictation({
  getLanguage: () => props.dictationLanguage ?? 'auto',
  onTranscript: (text) => {
    draft.value = draft.value ? `${draft.value}\n${text}` : text
    dictationFeedback.value = ''
    if (props.dictationAutoSend !== false) {
      const mode = props.isTurnInProgress ? activeInProgressMode.value : 'steer'
      onSubmit(mode)
      return
    }
    nextTick(() => inputRef.value?.focus())
  },
  onEmpty: () => {
    dictationFeedback.value = props.dictationClickToToggle
      ? 'No speech detected. Click again after speaking.'
      : 'No speech detected. Hold the mic and speak.'
  },
  onError: (error) => {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      dictationFeedback.value = 'Microphone access was denied.'
      return
    }
    dictationFeedback.value = error instanceof Error ? error.message : 'Dictation failed.'
  },
})
const attachMenuRootRef = ref<HTMLElement | null>(null)
const photoLibraryInputRef = ref<HTMLInputElement | null>(null)
const cameraCaptureInputRef = ref<HTMLInputElement | null>(null)
const folderPickerInputRef = ref<HTMLInputElement | null>(null)
const inputRef = ref<ComposerRichInputExposed | null>(null)
const lastComposerSelectionContext = ref<ComposerSelectionContext | null>(null)
const { isMobile } = useMobile()
const isAttachMenuOpen = ref(false)
const isMentionDrivenAttachMenu = ref(false)
const composerPlugins = ref<DirectoryPluginSummary[]>([])
const isLoadingComposerPlugins = ref(false)
const composerPluginsError = ref('')
const composerPluginsCwd = ref<string | null>(null)
const chatGptConversations = ref<ChatGptConversationSummary[]>([])
const isLoadingChatGptConversations = ref(false)
const hasLoadedChatGptConversations = ref(false)
const chatGptConversationsError = ref('')
const chatGptNextOffset = ref<number | null>(null)
const chatGptConversationLoadingId = ref('')
const mentionStartIndex = ref<number | null>(null)
const mentionQuery = ref('')
const fileMentionSuggestions = ref<ComposerFileSuggestion[]>([])
const isFileMentionOpen = ref(false)
const fileMentionHighlightedIndex = ref(0)
const skillMentionStartIndex = ref<number | null>(null)
const skillQuery = ref('')
const isSkillPickerOpen = ref(false)
const skillHighlightedIndex = ref(0)
const slashCommandHighlightedIndex = ref(0)
const isReviewChoiceOpen = ref(false)
const reviewBranch = ref('')
const reviewCommit = ref('')
const reviewBranchListId = `composer-review-branches-${Math.random().toString(36).slice(2, 10)}`
const isComposerExpanded = ref(false)
const isDraftOverflowing = ref(false)
let composerOverflowMeasurementQueued = false
const draftGeneration = ref(0)
let fileMentionSearchToken = 0
let fileMentionDebounceTimer: ReturnType<typeof setTimeout> | null = null
let isHoldPressActive = false
let dragDepth = 0
let attachmentSessionToken = 0
let bodyOverflowBeforeExpansion = ''
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
const DRAFT_STORAGE_PREFIX = 'codex-web-local.thread-draft.v1.'
let lastActiveThreadId = ''

const reasoningOptionCatalog: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' },
  { value: 'ultra', label: 'Ultra' },
]
const reasoningOptions = computed(() => {
  const supportedEfforts = props.modelReasoningEfforts?.[props.selectedModel] ?? FALLBACK_REASONING_EFFORTS
  const supportedSet = new Set(supportedEfforts)
  return reasoningOptionCatalog.filter((option) => supportedSet.has(option.value))
})
function formatModelLabel(modelId: string): string {
  return modelId.trim().replace(/^gpt/i, 'GPT')
}

const modelOptions = computed(() =>
  props.models.map((modelId) => ({
    value: modelId,
    label: props.modelLabels?.[modelId]?.trim() || formatModelLabel(modelId),
  })),
)
const isPlanModeSelected = computed(() => props.selectedCollaborationMode === 'plan')

const isPlanModeWaitingForModel = computed(() =>
  props.selectedCollaborationMode === 'plan' && props.selectedModel.trim().length === 0,
)

const matchingSkills = computed(() => {
  const query = skillQuery.value.trim().toLowerCase()
  return (props.skills ?? []).filter((skill) => {
    if (!query) return true
    return skill.name.toLowerCase().includes(query)
      || (skill.displayName ?? '').toLowerCase().includes(query)
      || skill.description.toLowerCase().includes(query)
  })
})
const enabledComposerPlugins = computed(() => composerPlugins.value.filter((plugin) => plugin.installed && plugin.enabled))
const isUnifiedAttachMenu = computed(() => isAttachMenuOpen.value && isMentionDrivenAttachMenu.value)
const visibleComposerPlugins = computed(() => {
  if (!isUnifiedAttachMenu.value) return enabledComposerPlugins.value
  const query = mentionQuery.value.trim().toLowerCase()
  if (!query) return enabledComposerPlugins.value
  return enabledComposerPlugins.value.filter((plugin) =>
    [plugin.displayName, plugin.description, plugin.id].some((value) => value.toLowerCase().includes(query)),
  )
})
const visibleChatGptConversations = computed(() => {
  if (!isUnifiedAttachMenu.value) return chatGptConversations.value
  const query = mentionQuery.value.trim().toLowerCase()
  if (!query) return chatGptConversations.value
  return chatGptConversations.value.filter((conversation) => conversation.title.toLowerCase().includes(query))
})

const canSubmit = computed(() => {
  if (props.disabled) return false
  if (props.isSubmitting) return false
  if (props.isUpdatingSpeedMode) return false
  if (!props.activeThreadId) return false
  if (isPlanModeWaitingForModel.value) return false
  if (pendingAttachmentCount.value > 0) return false
  return draft.value.trim().length > 0
    || selectedImages.value.length > 0
    || fileAttachments.value.length > 0
    || selectedComposerPlugins.value.length > 0
    || selectedChatGptConversations.value.length > 0
})
const hasUnsavedDraft = computed(() =>
  draft.value.trim().length > 0
  || selectedImages.value.length > 0
  || selectedSkills.value.length > 0
  || fileAttachments.value.length > 0
  || folderUploadGroups.value.length > 0,
)
const standaloneFileAttachments = computed(() => {
  const grouped = new Set<string>()
  for (const group of folderUploadGroups.value) {
    for (const path of group.filePaths) grouped.add(path)
  }
  return fileAttachments.value.filter((att) => !grouped.has(att.fsPath))
})
const hasDraftContext = computed(() =>
  selectedImages.value.length > 0
  || folderUploadGroups.value.length > 0
  || standaloneFileAttachments.value.length > 0
  || selectedSkills.value.length > 0,
)
const isInteractionDisabled = computed(() => props.disabled || !props.activeThreadId || props.isSubmitting === true)
const slashCommands = [
  { name: 'plan' as const, description: 'Switch to Plan mode; add text after the command to send it' },
  { name: 'memories' as const, description: 'Control memory use and generation for this chat' },
  { name: 'review' as const, description: 'Review uncommitted changes, a branch, or a commit' },
  { name: 'compact' as const, description: 'Compress context while retaining important work state' },
  { name: 'fork' as const, description: 'Fork this conversation into a new thread' },
  { name: 'status' as const, description: 'Show thread, model, and context status' },
  { name: 'fast' as const, description: 'Toggle faster inference, when supported' },
  { name: 'goal' as const, description: 'View or set a lasting goal; /goal clear removes it' },
] satisfies Array<{ name: ComposerCommandName; description: string }>
const slashCommandQuery = computed(() => getComposerCommandQuery(draft.value))
const slashCommandSuggestions = computed(() => {
  const query = slashCommandQuery.value
  if (query === null) return []
  return slashCommands.filter((command) => command.name.startsWith(query))
})
const isSlashCommandOpen = computed(() =>
  !isInteractionDisabled.value && !isReviewChoiceOpen.value && slashCommandSuggestions.value.length > 0,
)
const isComposerConfigDisabled = computed(() => props.disabled || !props.activeThreadId || props.isSubmitting === true)
const isFastModeSupported = computed(() => /^gpt-5\.(?:4|5)(?:$|-)/.test(props.selectedModel.trim()))
const showFastModeModelIcon = computed(() =>
  props.selectedSpeedMode === 'fast' && isFastModeSupported.value,
)
const isSpeedToggleDisabled = computed(() =>
  isInteractionDisabled.value || props.isUpdatingSpeedMode === true,
)
const speedModeDescription = computed(() => {
  if (props.isUpdatingSpeedMode) {
    return t('Saving speed setting...')
  }
  return props.selectedSpeedMode === 'fast'
    ? t('About 1.5x faster, with credits used at 2x')
    : t('Default speed with normal credit usage')
})
const inProgressMode = computed<'steer' | 'queue'>(() =>
  props.inProgressSubmitMode === 'steer' ? 'steer' : 'queue',
)
const activeInProgressMode = ref<'steer' | 'queue'>(inProgressMode.value)
const isDictationRecording = computed(() => dictationState.value === 'recording')
const dictationButtonLabel = computed(() => {
  if (dictationState.value === 'recording') return t('Stop dictation')
  return props.dictationClickToToggle ? t('Click to dictate') : t('Hold to dictate')
})
const dictationErrorText = computed(() =>
  dictationState.value === 'idle' ? dictationFeedback.value.trim() : '',
)
const attachmentFeedbackText = computed(() => {
  const stats = attachmentBatchStats.value
  if (stats) {
    const completed = stats.succeeded + stats.failed
    const remaining = Math.max(0, stats.total - completed)
    if (remaining > 0) {
      if (stats.failed > 0) {
        return `${stats.failed} ${t('failed')}, ${t('attaching')} ${formatAttachmentFileCount(remaining)}...`
      }
      return remaining === 1 ? t('Attaching file...') : `${t('Attaching')} ${remaining} ${t('files...')}`
    }
    if (stats.failed > 0) {
      if (stats.succeeded > 0) {
        return `${stats.succeeded} ${t('attached')}, ${stats.failed} ${t('failed')}.`
      }
      return stats.failed === 1 ? t('Could not attach file.') : `${t('Could not attach')} ${stats.failed} ${t('files.')}`
    }
  }
  if (pendingAttachmentCount.value <= 0) return ''
  return pendingAttachmentCount.value === 1
    ? t('Attaching file...')
    : `${t('Attaching')} ${pendingAttachmentCount.value} ${t('files...')}`
})
const dictationDurationLabel = computed(() => {
  const totalSeconds = Math.max(0, Math.floor(recordingDurationMs.value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const placeholderText = computed(() =>
  !props.activeThreadId
    ? t('Select a thread to send a message')
    : isPlanModeWaitingForModel.value
      ? t('Loading models for plan mode...')
      : t('Type a message... (@ for files)'),
)
const hasSubmitContent = computed(() =>
  draft.value.trim().length > 0 || selectedImages.value.length > 0 || fileAttachments.value.length > 0,
)
const draftLineCount = computed(() => draft.value.split('\n').length)
const hasExpandedComposerToggle = computed(() =>
  isComposerExpanded.value || draftLineCount.value >= 6 || isDraftOverflowing.value,
)
const quotaSummaryText = computed(() => buildQuotaSummaryText(props.codexQuota ?? null))
const quotaWeeklyRefreshText = computed(() => '')
const quotaTooltipText = computed(() => buildQuotaTooltipText(props.codexQuota ?? null))
const contextUsageView = computed(() => buildContextUsageView(props.threadTokenUsage ?? null))
const contextUsageRemainingPercent = computed(() => contextUsageView.value?.percentRemaining ?? 0)
const contextUsageTone = computed(() => contextUsageView.value?.tone ?? 'healthy')
const contextUsageUsedPercent = computed(() => Math.max(0, Math.min(100, 100 - contextUsageRemainingPercent.value)))
const contextTokensInUse = computed(() => Math.max(0, props.threadTokenUsage?.currentContextTokens ?? 0))
const contextWindowTokens = computed(() => Math.max(0, props.threadTokenUsage?.modelContextWindow ?? 0))

function formatPlanType(planType: string | null | undefined): string {
  if (!planType || planType === 'unknown') return ''
  if (planType === 'edu') return 'Education'
  return `${planType.slice(0, 1).toUpperCase()}${planType.slice(1)}`
}

function formatWindowSpan(windowMinutes: number | null): string {
  if (typeof windowMinutes !== 'number' || !Number.isFinite(windowMinutes) || windowMinutes <= 0) return ''
  if (windowMinutes % 1440 === 0) return `${windowMinutes / 1440}d`
  if (windowMinutes % 60 === 0) return `${windowMinutes / 60}h`
  return `${windowMinutes}m`
}

function formatResetTime(resetsAt: number | null): string {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return ''
  const resetMs = resetsAt * 1000
  const diffMs = resetMs - Date.now()
  if (diffMs <= 0) return 'resetting now'

  const totalMinutes = Math.round(diffMs / 60000)
  if (totalMinutes < 60) return `resets in ${Math.max(1, totalMinutes)}m`

  const totalHours = Math.round(totalMinutes / 60)
  if (totalHours < 48) return `resets in ${Math.max(1, totalHours)}h`

  const totalDays = Math.round(totalHours / 24)
  return `resets in ${Math.max(1, totalDays)}d`
}

function formatResetDate(resetsAt: number | null): string {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(resetsAt * 1000))
}

function formatResetDateCompact(resetsAt: number | null): string {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return ''
  const date = new Date(resetsAt * 1000)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function pickWeeklyQuotaWindow(quota: UiRateLimitSnapshot): UiRateLimitWindow | null {
  const windows = [quota.primary, quota.secondary].filter((window): window is UiRateLimitWindow => window !== null)
  const exactWeekly = windows.find((window) => window.windowMinutes === 7 * 24 * 60)
  if (exactWeekly) return exactWeekly

  const longerWindows = windows
    .filter((window) => typeof window.windowMinutes === 'number' && window.windowMinutes >= 7 * 24 * 60)
    .sort((first, second) => (first.windowMinutes ?? 0) - (second.windowMinutes ?? 0))

  if (longerWindows[0]) return longerWindows[0]
  return quota.secondary ?? null
}

function formatWindowSummary(window: UiRateLimitWindow): string {
  const remainingPercent = Math.max(0, Math.min(100, 100 - Math.round(window.usedPercent)))
  const span = formatWindowSpan(window.windowMinutes)
  return span ? `${remainingPercent}% / ${span}` : `${remainingPercent}%`
}

function buildQuotaSummaryText(quota: UiRateLimitSnapshot | null): string {
  if (!quota) return ''

  const segments: string[] = []
  const plan = formatPlanType(quota.planType)
  if (plan) segments.push(plan)
  if (quota.primary) segments.push(formatWindowSummary(quota.primary))
  if (quota.secondary) segments.push(formatWindowSummary(quota.secondary))

  const weeklyWindow = pickWeeklyQuotaWindow(quota)
  const weeklyRefreshDate = formatResetDateCompact(weeklyWindow?.resetsAt ?? null)
  if (weeklyRefreshDate) {
    segments.push(weeklyRefreshDate)
  }

  if (segments.length === 0 && quota.credits?.unlimited) {
    segments.push('Unlimited credits')
  } else if (segments.length === 0 && quota.credits?.hasCredits && quota.credits.balance) {
    segments.push(`${quota.credits.balance} credits`)
  }

  return segments.join(' · ')
}

function buildQuotaTooltipText(quota: UiRateLimitSnapshot | null): string {
  if (!quota) return ''

  const lines: string[] = []
  const plan = formatPlanType(quota.planType)
  if (plan) {
    lines.push(`Plan: ${plan}`)
  }

  if (quota.primary) {
    const reset = formatResetTime(quota.primary.resetsAt)
    lines.push(`Primary window: ${formatWindowSummary(quota.primary)}${reset ? `, ${reset}` : ''}`)
  }

  if (quota.secondary) {
    const reset = formatResetTime(quota.secondary.resetsAt)
    lines.push(`Secondary window: ${formatWindowSummary(quota.secondary)}${reset ? `, ${reset}` : ''}`)
  }

  if (quota.credits?.unlimited) {
    lines.push('Credits: unlimited')
  } else if (quota.credits?.hasCredits && quota.credits.balance) {
    lines.push(`Credits: ${quota.credits.balance}`)
  }

  const weeklyWindow = pickWeeklyQuotaWindow(quota)
  if (weeklyWindow) {
    const weeklyRefreshDate = formatResetDate(weeklyWindow.resetsAt)
    if (weeklyRefreshDate) {
      lines.push(`Weekly refresh: ${weeklyRefreshDate}`)
    }
  }

  return lines.join('\n')
}

function buildQuotaWeeklyRefreshText(quota: UiRateLimitSnapshot | null): string {
  if (!quota) return ''
  const weeklyWindow = pickWeeklyQuotaWindow(quota)
  if (!weeklyWindow) return ''
  const weeklyRefreshDate = formatResetDate(weeklyWindow.resetsAt)
  return weeklyRefreshDate ? `Weekly refresh ${weeklyRefreshDate}` : ''
}

function formatCompactTokenCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) {
    const compact = absValue >= 10_000_000 ? (value / 1_000_000).toFixed(0) : (value / 1_000_000).toFixed(1)
    return `${compact.replace(/\.0$/, '')}M`
  }
  if (absValue >= 1_000) {
    const compact = absValue >= 100_000 ? (value / 1_000).toFixed(0) : (value / 1_000).toFixed(1)
    return `${compact.replace(/\.0$/, '')}k`
  }
  return String(Math.round(value))
}

function buildContextUsageView(
  usage: UiThreadTokenUsage | null,
): {
    percentRemaining: number
    tone: 'healthy' | 'warning' | 'danger'
  } | null {
  if (!usage) return null

  const contextWindow = usage.modelContextWindow ?? null
  if (typeof contextWindow !== 'number' || !Number.isFinite(contextWindow) || contextWindow <= 0) return null

  const percentRemaining = usage.remainingContextPercent === null
    ? Math.max(0, Math.min(100, Math.round((Math.max(contextWindow - usage.currentContextTokens, 0) / contextWindow) * 100)))
    : usage.remainingContextPercent
  const tone: 'healthy' | 'warning' | 'danger' = percentRemaining <= 15
    ? 'danger'
    : percentRemaining <= 35
      ? 'warning'
      : 'healthy'

  return {
    percentRemaining,
    tone,
  }
}

function onSubmit(mode: 'steer' | 'queue' = 'steer'): void {
  if (isReviewChoiceOpen.value) return
  const text = buildSubmissionText()
  if (!canSubmit.value) return
  const command = parseComposerCommand(text)
  const submission: SubmitPayload = {
    text: command?.name === 'plan' ? command.argument : text,
    imageUrls: selectedImages.value.map((image) => image.url),
    fileAttachments: [...fileAttachments.value],
    skills: selectedSkills.value.map((s) => ({ name: s.name, path: s.path })),
    mode,
  }
  if (command) {
    if (command.name === 'review' && !command.target) {
      reviewBranch.value = props.reviewBranches?.find((branch) => !branch.isCurrent)?.value ?? ''
      reviewCommit.value = ''
      isReviewChoiceOpen.value = true
      return
    }
    emit('execute-command', { command, submission })
    return
  }
  emit('submit', submission)
}

function executeSuggestedCommand(name: ComposerCommandName): void {
  draft.value = `/${name}`
  slashCommandHighlightedIndex.value = 0
  onSubmit(props.isTurnInProgress ? activeInProgressMode.value : 'steer')
}

function closeReviewChoices(): void {
  isReviewChoiceOpen.value = false
  draft.value = ''
  nextTick(() => inputRef.value?.focus())
}

function submitReviewTarget(target: ReviewCommandTarget): void {
  if (isInteractionDisabled.value || props.isTurnInProgress) return
  const submission: SubmitPayload = {
    text: '', imageUrls: [], fileAttachments: [], skills: [], mode: 'steer',
  }
  emit('execute-command', { command: { name: 'review', target }, submission })
}

function setActiveInProgressMode(mode: 'steer' | 'queue'): void {
  activeInProgressMode.value = mode
}

function replaceDraftState(payload: ComposerDraftPayload): void {
  draftGeneration.value += 1
  draft.value = payload.text
  selectedImages.value = payload.imageUrls.map((url, index) => ({
    id: `queued-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Image ${index + 1}`,
    url,
  }))
  selectedSkills.value = payload.skills.map((skill) => (
    (props.skills ?? []).find((item) => item.path === skill.path)
    ?? { name: skill.name, displayName: undefined, description: '', path: skill.path }
  ))
  selectedComposerPlugins.value = []
  selectedChatGptConversations.value = []
  fileAttachments.value = payload.fileAttachments.map((attachment) => ({ ...attachment }))
  folderUploadGroups.value = []
  dictationFeedback.value = ''
  attachmentBatchStats.value = null
  pendingAttachmentCount.value = 0
  isAttachMenuOpen.value = false
  closeFileMention()
  closeSkillPicker()
  attachmentSessionToken += 1
}

function clearDraftState(): void {
  isReviewChoiceOpen.value = false
  replaceDraftState({
    text: '',
    imageUrls: [],
    fileAttachments: [],
    skills: [],
  })
  isComposerExpanded.value = false
}

function getDraftStorageKey(threadId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${threadId}`
}

function loadPersistedDraftForThread(threadId: string): ComposerDraftPayload | null {
  if (typeof window === 'undefined') return null
  const normalizedThreadId = threadId.trim()
  if (!normalizedThreadId) return null
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(normalizedThreadId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ComposerDraftPayload> | string
    if (typeof parsed === 'string') {
      return {
        text: parsed,
        imageUrls: [],
        fileAttachments: [],
        skills: [],
      }
    }
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      imageUrls: Array.isArray(parsed.imageUrls)
        ? parsed.imageUrls.filter((url): url is string => typeof url === 'string')
        : [],
      fileAttachments: Array.isArray(parsed.fileAttachments)
        ? parsed.fileAttachments.filter((attachment): attachment is FileAttachment => (
          Boolean(attachment)
          && typeof attachment.label === 'string'
          && typeof attachment.path === 'string'
          && typeof attachment.fsPath === 'string'
        ))
        : [],
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((skill): skill is { name: string; path: string } => (
          Boolean(skill)
          && typeof skill.name === 'string'
          && typeof skill.path === 'string'
        ))
        : [],
    }
  } catch {
    return null
  }
}

function persistDraftForThread(threadId: string, payload: ComposerDraftPayload): void {
  if (typeof window === 'undefined') return
  const normalizedThreadId = threadId.trim()
  if (!normalizedThreadId) return
  try {
    const hasContent = payload.text.trim().length > 0
      || payload.imageUrls.length > 0
      || payload.fileAttachments.length > 0
      || payload.skills.length > 0
    if (hasContent) {
      window.localStorage.setItem(getDraftStorageKey(normalizedThreadId), JSON.stringify(payload))
      return
    }
    window.localStorage.removeItem(getDraftStorageKey(normalizedThreadId))
  } catch {
    // Ignore localStorage failures (quota/private mode).
  }
}

function clearPersistedDraftForThread(threadId: string): void {
  persistDraftForThread(threadId, {
    text: '',
    imageUrls: [],
    fileAttachments: [],
    skills: [],
  })
}

function getCurrentDraftPayload(): ComposerDraftPayload {
  return {
    text: draft.value,
    imageUrls: selectedImages.value.map((image) => image.url),
    fileAttachments: fileAttachments.value.map((attachment) => ({ ...attachment })),
    skills: selectedSkills.value.map((skill) => ({ name: skill.name, path: skill.path })),
  }
}

function onInterrupt(): void {
  emit('interrupt')
}

function updateComposerOverflowState(): void {
  const input = inputRef.value
  if (!input) {
    isDraftOverflowing.value = false
    return
  }
  const { scrollHeight, clientHeight } = input.getScrollMetrics()
  isDraftOverflowing.value = scrollHeight > clientHeight + 2
}

function queueComposerOverflowMeasurement(): void {
  if (composerOverflowMeasurementQueued) return
  composerOverflowMeasurementQueued = true
  void nextTick(() => {
    composerOverflowMeasurementQueued = false
    updateComposerOverflowState()
  })
}

function toggleComposerExpanded(): void {
  if (isInteractionDisabled.value) return
  isComposerExpanded.value = !isComposerExpanded.value
  queueComposerOverflowMeasurement()
  void nextTick(() => inputRef.value?.focus())
}

function buildSubmissionText(): string {
  const sections = [draft.value.trim()]
  for (const plugin of selectedComposerPlugins.value) {
    const prompt = plugin.defaultPrompt.join('\n').trim()
    sections.push(prompt || `Use the ${plugin.displayName} plugin for this request.`)
  }
  for (const conversation of selectedChatGptConversations.value) {
    sections.push(buildChatGptConversationReferenceBlock(conversation))
  }
  return sections.filter(Boolean).join('\n\n').trim()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isComposerExpanded.value) return
  if (isFileMentionOpen.value || isSlashCommandOpen.value || isAttachMenuOpen.value) return
  isComposerExpanded.value = false
  queueComposerOverflowMeasurement()
}

function onModelSelect(value: string): void {
  emit('update:selected-model', value)
}

function toggleCollaborationMode(): void {
  emit('update:selected-collaboration-mode', isPlanModeSelected.value ? 'default' : 'plan')
}

function togglePlanModeFromAttachMenu(): void {
  consumeMentionToken()
  toggleCollaborationMode()
  isAttachMenuOpen.value = false
  isMentionDrivenAttachMenu.value = false
}

function completeSubmission(): void {
  clearPersistedDraftForThread(props.activeThreadId)
  clearDraftState()
  folderUploadGroups.value = []
  isAttachMenuOpen.value = false
  closeFileMention()
  closeSkillPicker()
  if (isAndroid || isMobile.value) {
    inputRef.value?.blur()
    return
  }
  nextTick(() => inputRef.value?.focus())
}

function onPermissionPresetSelected(preset: PermissionPreset): void {
  if (preset === 'fullAccess') {
    isFullAccessConfirmationOpen.value = true
    return
  }
  emit('update:selected-permission-preset', preset)
}

function confirmFullAccess(): void {
  isFullAccessConfirmationOpen.value = false
  emit('update:selected-permission-preset', 'fullAccess')
}

function onReasoningEffortSelect(value: string): void {
  emit('update:selected-reasoning-effort', value as ReasoningEffort)
}

function onToggleSpeedMode(): void {
  if (isSpeedToggleDisabled.value) return
  emit('update:selected-speed-mode', props.selectedSpeedMode === 'fast' ? 'standard' : 'fast')
}

function onDictationToggle(): void {
  if (!props.dictationClickToToggle) return
  if (dictationFeedback.value) {
    dictationFeedback.value = ''
  }
  toggleRecording()
}

function onDictationPressStart(event: PointerEvent): void {
  if (props.dictationClickToToggle) return
  event.preventDefault()
  if (isHoldPressActive) return
  isHoldPressActive = true
  const target = event.currentTarget as HTMLElement | null
  if (target) {
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      // Ignore if pointer cannot be captured in the current environment.
    }
  }
  if (dictationFeedback.value) {
    dictationFeedback.value = ''
  }
  window.addEventListener('pointerup', onDictationPressEnd)
  window.addEventListener('pointercancel', onDictationPressEnd)
  window.addEventListener('blur', onDictationPressEnd)
  void startRecording()
}

function onDictationPressEnd(): void {
  if (props.dictationClickToToggle) return
  if (!isHoldPressActive) return
  isHoldPressActive = false
  window.removeEventListener('pointerup', onDictationPressEnd)
  window.removeEventListener('pointercancel', onDictationPressEnd)
  window.removeEventListener('blur', onDictationPressEnd)
  stopRecording()
}

function toggleAttachMenu(): void {
  if (isInteractionDisabled.value) return
  isAttachMenuOpen.value = !isAttachMenuOpen.value
  isMentionDrivenAttachMenu.value = false
  if (!isAttachMenuOpen.value) closeFileMention()
  if (isAttachMenuOpen.value) {
    void loadComposerPlugins()
    void loadChatGptConversations()
  }
}

async function loadComposerPlugins(options: { force?: boolean; retryAttempt?: number } = {}): Promise<void> {
  const cwd = (props.cwd ?? '').trim()
  if (isLoadingComposerPlugins.value) return
  if (!options.force && composerPluginsCwd.value === cwd && !composerPluginsError.value) return
  isLoadingComposerPlugins.value = true
  composerPluginsError.value = ''
  try {
    const plugins = await listDirectoryPlugins(cwd ? [cwd] : undefined)
    if ((props.cwd ?? '').trim() !== cwd) {
      composerPlugins.value = []
      composerPluginsCwd.value = null
      if (isAttachMenuOpen.value) window.setTimeout(() => void loadComposerPlugins(), 0)
      return
    }
    composerPlugins.value = plugins
    composerPluginsCwd.value = cwd
  } catch (error) {
    composerPlugins.value = []
    composerPluginsCwd.value = null
    if ((options.retryAttempt ?? 0) === 0) {
      window.setTimeout(() => void loadComposerPlugins({ force: true, retryAttempt: 1 }), 500)
      return
    }
    composerPluginsError.value = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : t('Failed to load plugins')
  } finally {
    isLoadingComposerPlugins.value = false
  }
}

async function loadChatGptConversations(options: { more?: boolean; retryAttempt?: number } = {}): Promise<void> {
  if (isLoadingChatGptConversations.value) return
  if (!options.more && hasLoadedChatGptConversations.value && !chatGptConversationsError.value) return
  isLoadingChatGptConversations.value = true
  chatGptConversationsError.value = ''
  try {
    const offset = options.more ? chatGptNextOffset.value : 0
    if (offset === null) return
    const page: ChatGptConversationPage = await listChatGptConversations(offset)
    const merged = options.more ? [...chatGptConversations.value, ...page.conversations] : page.conversations
    chatGptConversations.value = Array.from(new Map(merged.map((item) => [item.conversationId, item])).values())
    chatGptNextOffset.value = page.nextOffset
    hasLoadedChatGptConversations.value = true
  } catch (error) {
    if ((options.retryAttempt ?? 0) === 0) {
      window.setTimeout(() => void loadChatGptConversations({ ...options, retryAttempt: 1 }), 500)
      return
    }
    if (!options.more) chatGptConversations.value = []
    chatGptConversationsError.value = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : t('Failed to load ChatGPT conversations')
  } finally {
    isLoadingChatGptConversations.value = false
  }
}

async function selectChatGptConversation(conversation: ChatGptConversationSummary): Promise<void> {
  if (isInteractionDisabled.value || chatGptConversationLoadingId.value) return
  chatGptConversationLoadingId.value = conversation.conversationId
  insertComposerReference({
    kind: 'chatgpt-conversation',
    id: conversation.conversationId,
    label: conversation.title,
    href: composerReferenceHref('chatgpt-conversation', conversation.conversationId),
  })
  if (!selectedChatGptConversations.value.some((item) => item.conversationId === conversation.conversationId)) {
    selectedChatGptConversations.value = [...selectedChatGptConversations.value, { ...conversation, preview: null }]
  }
  try {
    const detail = await getChatGptConversationPreview(conversation.conversationId)
    selectedChatGptConversations.value = selectedChatGptConversations.value.map((item) =>
      item.conversationId === detail.conversationId ? detail : item,
    )
  } catch {
    // The inline reference remains useful: the model can load it with read_thread.
  } finally {
    chatGptConversationLoadingId.value = ''
  }
}

function localAssetSrc(path: string): string {
  if (!path) return ''
  if (path.startsWith('connectors://')) return `/codex-api/connector-logo?src=${encodeURIComponent(path)}`
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path
  if (!path.startsWith('/')) return ''
  return `/codex-local-image?path=${encodeURIComponent(path)}`
}

function pluginIconSrc(plugin: DirectoryPluginSummary): string {
  return plugin.logoUrl || localAssetSrc(plugin.logoPath) || plugin.composerIconUrl || localAssetSrc(plugin.composerIconPath)
}

function selectComposerPlugin(plugin: DirectoryPluginSummary): void {
  insertComposerReference({
    kind: 'plugin',
    id: plugin.id,
    label: plugin.displayName,
    href: composerReferenceHref('plugin', plugin.id),
    iconSrc: pluginIconSrc(plugin),
  })
  if (!selectedComposerPlugins.value.some((item) => item.id === plugin.id)) {
    selectedComposerPlugins.value = [...selectedComposerPlugins.value, plugin]
  }
  isAttachMenuOpen.value = false
  isMentionDrivenAttachMenu.value = false
}

function insertComposerReference(reference: ComposerInlineReference): void {
  const input = inputRef.value
  const context = input?.getSelectionContext() ?? lastComposerSelectionContext.value
  if (!input || !context) return
  const from = isMentionDrivenAttachMenu.value && mentionStartIndex.value !== null
    ? mentionStartIndex.value
    : context.from
  input.replaceRangeWithReference(from, context.to, reference)
  closeFileMention()
  isAttachMenuOpen.value = false
  isMentionDrivenAttachMenu.value = false
}

function onComposerReferencesChange(references: ComposerInlineReference[]): void {
  const pluginReferences = references.filter((item) => item.kind === 'plugin')
  const conversationReferences = references.filter((item) => item.kind === 'chatgpt-conversation')
  const existingPlugins = new Map(selectedComposerPlugins.value.map((plugin) => [plugin.id, plugin]))
  const availablePlugins = new Map(composerPlugins.value.map((plugin) => [plugin.id, plugin]))
  selectedComposerPlugins.value = pluginReferences.flatMap((reference) => {
    const plugin = existingPlugins.get(reference.id) ?? availablePlugins.get(reference.id)
    return plugin ? [plugin] : []
  })

  const existingConversations = new Map(
    selectedChatGptConversations.value.map((conversation) => [conversation.conversationId, conversation]),
  )
  selectedChatGptConversations.value = conversationReferences.map((reference) =>
    existingConversations.get(reference.id) ?? {
      conversationId: reference.id,
      title: reference.label,
      updatedAt: null,
      preview: null,
    },
  )
}

function triggerPhotoLibrary(): void {
  consumeMentionToken()
  isAttachMenuOpen.value = false
  photoLibraryInputRef.value?.click()
}

function triggerCameraCapture(): void {
  consumeMentionToken()
  isAttachMenuOpen.value = false
  cameraCaptureInputRef.value?.click()
}

function triggerFolderPicker(): void {
  consumeMentionToken()
  isAttachMenuOpen.value = false
  folderPickerInputRef.value?.click()
}

function removeImage(id: string): void {
  selectedImages.value = selectedImages.value.filter((image) => image.id !== id)
}

function removeSkill(path: string): void {
  selectedSkills.value = selectedSkills.value.filter((s) => s.path !== path)
}

function skillMarkdownPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/SKILL.md') ? trimmed : `${trimmed.replace(/\/+$/, '')}/SKILL.md`
}

function openSkillMarkdown(skill: SkillItem): void {
  const markdownPath = skillMarkdownPath(skill.path)
  if (!markdownPath || typeof window === 'undefined') return
  window.open(`/codex-local-browse${encodeURI(markdownPath)}`, '_blank', 'noopener,noreferrer')
}

function removeFileAttachment(fsPath: string): void {
  fileAttachments.value = fileAttachments.value.filter((a) => a.fsPath !== fsPath)
}

function removeFolderAttachment(groupId: string): void {
  const group = folderUploadGroups.value.find((item) => item.id === groupId)
  if (!group) return
  const toRemove = new Set(group.filePaths)
  fileAttachments.value = fileAttachments.value.filter((a) => !toRemove.has(a.fsPath))
  folderUploadGroups.value = folderUploadGroups.value.filter((item) => item.id !== groupId)
}

function getFolderUploadPercent(group: FolderUploadGroup): number {
  if (group.total <= 0) return 0
  return Math.round((group.processed / group.total) * 100)
}

function addFileAttachment(filePath: string, customLabel?: string): void {
  const normalized = filePath.replace(/\\/g, '/')
  if (fileAttachments.value.some((a) => a.fsPath === normalized)) return
  const parts = normalized.split('/').filter(Boolean)
  const label = customLabel?.trim() || parts[parts.length - 1] || normalized
  fileAttachments.value = [...fileAttachments.value, { label, path: normalized, fsPath: normalized }]
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

function normalizeSelectedFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files) return []
  return Array.from(files)
}

function formatAttachmentFileCount(count: number): string {
  return count === 1 ? '1 file' : `${count} files`
}

function beginAttachmentWork(sessionToken: number): boolean {
  if (sessionToken !== attachmentSessionToken) return false
  pendingAttachmentCount.value += 1
  return true
}

function finishAttachmentWork(sessionToken: number): void {
  if (sessionToken !== attachmentSessionToken) return
  pendingAttachmentCount.value = Math.max(0, pendingAttachmentCount.value - 1)
}

function beginAttachmentBatch(total: number): void {
  if (total <= 0) return
  const current = attachmentBatchStats.value
  const completed = current ? current.succeeded + current.failed : 0
  if (!current || completed >= current.total) {
    attachmentBatchStats.value = { total, succeeded: 0, failed: 0 }
    return
  }
  attachmentBatchStats.value = {
    ...current,
    total: current.total + total,
  }
}

function recordAttachmentBatchResult(result: 'success' | 'failure'): void {
  const current = attachmentBatchStats.value
  if (!current) return
  attachmentBatchStats.value = {
    ...current,
    succeeded: current.succeeded + (result === 'success' ? 1 : 0),
    failed: current.failed + (result === 'failure' ? 1 : 0),
  }
}

function createAttachmentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createPastedImageName(file: File): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('-')
  const ext = file.type.startsWith('image/')
    ? file.type.slice('image/'.length).replace(/[^a-z0-9]+/gi, '') || 'png'
    : 'png'
  return `pasted-image-${timestamp}.${ext}`
}

function createPastedTextFileName(): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('-')
  return `pasted-text-${timestamp}.txt`
}

function ensureFileName(file: File): File {
  if (file.name.trim()) return file
  return new File([file], createPastedImageName(file), {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  })
}

async function attachImageFile(file: File, sessionToken: number): Promise<void> {
  if (!beginAttachmentWork(sessionToken)) return
  try {
    const normalizedFile = ensureFileName(file)
    const serverPath = await uploadFile(normalizedFile)
    if (sessionToken !== attachmentSessionToken) return
    if (!serverPath) {
      recordAttachmentBatchResult('failure')
      return
    }
    selectedImages.value = [
      ...selectedImages.value,
      {
        id: createAttachmentId(),
        name: normalizedFile.name,
        url: `/codex-local-image?path=${encodeURIComponent(serverPath)}`,
      },
    ]
    recordAttachmentBatchResult('success')
  } catch {
    if (sessionToken === attachmentSessionToken) {
      recordAttachmentBatchResult('failure')
    }
  } finally {
    finishAttachmentWork(sessionToken)
  }
}

async function attachUploadedFile(file: File, sessionToken: number): Promise<void> {
  if (!beginAttachmentWork(sessionToken)) return
  try {
    const serverPath = await uploadFile(file)
    if (sessionToken !== attachmentSessionToken) return
    if (!serverPath) {
      recordAttachmentBatchResult('failure')
      return
    }
    addFileAttachment(serverPath)
    recordAttachmentBatchResult('success')
  } catch {
    if (sessionToken === attachmentSessionToken) {
      recordAttachmentBatchResult('failure')
    }
  } finally {
    finishAttachmentWork(sessionToken)
  }
}

function attachIncomingFiles(files: FileList | File[] | null | undefined): void {
  const normalizedFiles = normalizeSelectedFiles(files)
  if (normalizedFiles.length === 0) return
  beginAttachmentBatch(normalizedFiles.length)
  isAttachMenuOpen.value = false
  closeFileMention()
  const sessionToken = attachmentSessionToken
  for (const file of normalizedFiles) {
    if (isImageFile(file)) {
      void attachImageFile(file, sessionToken)
    } else {
      void attachUploadedFile(file, sessionToken)
    }
  }
}

function resetDragState(): void {
  dragDepth = 0
  isDragActive.value = false
}

function hasFilePayload(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types ?? []).some((type) => type.toLowerCase() === 'files')
}

async function addFolderFiles(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return
  const generation = draftGeneration.value
  const rows = Array.from(files)
  const firstRelativePath = (rows[0] as File & { webkitRelativePath?: string }).webkitRelativePath || rows[0].name
  const folderName = firstRelativePath.split('/').filter(Boolean)[0] || 'Folder'
  const groupId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  folderUploadGroups.value = [
    ...folderUploadGroups.value,
    {
      id: groupId,
      name: folderName,
      total: rows.length,
      processed: 0,
      filePaths: [],
      isUploading: true,
    },
  ]

  const updateGroup = (updater: (group: FolderUploadGroup) => FolderUploadGroup): void => {
    if (generation !== draftGeneration.value) return
    folderUploadGroups.value = folderUploadGroups.value.map((group) => (
      group.id === groupId ? updater(group) : group
    ))
  }

  for (const file of rows) {
    try {
      const serverPath = await uploadFile(file)
      if (generation !== draftGeneration.value) return
      if (serverPath) {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
        addFileAttachment(serverPath, relativePath)
        updateGroup((group) => ({
          ...group,
          processed: group.processed + 1,
          filePaths: [...group.filePaths, serverPath],
        }))
        continue
      }
      updateGroup((group) => ({ ...group, processed: group.processed + 1 }))
    } catch {
      updateGroup((group) => ({ ...group, processed: group.processed + 1 }))
    }
  }

  updateGroup((group) => ({ ...group, isUploading: false }))
}

function clearInputValue(inputRefEl: HTMLInputElement | null): void {
  if (inputRefEl) inputRefEl.value = ''
}

function onPhotoLibraryChange(event: Event): void {
  const input = event.target as HTMLInputElement | null
  attachIncomingFiles(input?.files ?? null)
  clearInputValue(input)
  isAttachMenuOpen.value = false
}

function onCameraCaptureChange(event: Event): void {
  const input = event.target as HTMLInputElement | null
  attachIncomingFiles(input?.files ?? null)
  clearInputValue(input)
  isAttachMenuOpen.value = false
}

function onFolderPickerChange(event: Event): void {
  const input = event.target as HTMLInputElement | null
  void addFolderFiles(input?.files ?? null)
  clearInputValue(input)
  isAttachMenuOpen.value = false
}

function onInputDragEnter(event: DragEvent): void {
  if (isInteractionDisabled.value || !hasFilePayload(event.dataTransfer)) return
  event.preventDefault()
  dragDepth += 1
  isDragActive.value = true
}

function onInputDragOver(event: DragEvent): void {
  if (isInteractionDisabled.value || !hasFilePayload(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isDragActive.value = true
}

function onInputDragLeave(event: DragEvent): void {
  if (!isDragActive.value) return
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) {
    resetDragState()
  }
}

function onInputDrop(event: DragEvent): void {
  if (isInteractionDisabled.value || !hasFilePayload(event.dataTransfer)) return
  event.preventDefault()
  resetDragState()
  attachIncomingFiles(event.dataTransfer?.files ?? null)
}

function onWindowDragCleanup(): void {
  if (!isDragActive.value && dragDepth === 0) return
  resetDragState()
}

function onInputPaste(event: ClipboardEvent): void {
  if (isInteractionDisabled.value) return
  const plainText = event.clipboardData?.getData('text/plain') ?? ''
  if (plainText.length >= PASTED_TEXT_FILE_THRESHOLD) {
    event.preventDefault()
    const textFile = new File([plainText], createPastedTextFileName(), {
      type: 'text/plain',
      lastModified: Date.now(),
    })
    attachIncomingFiles([textFile])
    return
  }
  const items = Array.from(event.clipboardData?.items ?? [])
  if (items.length === 0) return
  const hasPlainText = plainText.length > 0
  const imageFiles = items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File)
  if (imageFiles.length === 0) return
  if (!hasPlainText) {
    event.preventDefault()
  }
  attachIncomingFiles(imageFiles)
}

function onInputChange(context?: ComposerSelectionContext): void {
  if (context) lastComposerSelectionContext.value = context
  if (dictationFeedback.value) {
    dictationFeedback.value = ''
  }
  queueComposerOverflowMeasurement()
  updateFileMentionState(context)
  updateSkillMentionState(context)
}

function onInputKeydown(event: KeyboardEvent): void {
  if (isReviewChoiceOpen.value && event.key === 'Escape') {
    event.preventDefault()
    closeReviewChoices()
    return
  }
  if (isSlashCommandOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      draft.value = ''
      slashCommandHighlightedIndex.value = 0
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      slashCommandHighlightedIndex.value =
        (slashCommandHighlightedIndex.value + 1) % slashCommandSuggestions.value.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const size = slashCommandSuggestions.value.length
      slashCommandHighlightedIndex.value = (slashCommandHighlightedIndex.value + size - 1) % size
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const selected = slashCommandSuggestions.value[slashCommandHighlightedIndex.value]
      if (selected) executeSuggestedCommand(selected.name)
      return
    }
  }

  if (isSkillPickerOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSkillPicker()
      return
    }
    if (event.key === 'ArrowDown' && matchingSkills.value.length > 0) {
      event.preventDefault()
      skillHighlightedIndex.value = (skillHighlightedIndex.value + 1) % matchingSkills.value.length
      return
    }
    if (event.key === 'ArrowUp' && matchingSkills.value.length > 0) {
      event.preventDefault()
      skillHighlightedIndex.value = (skillHighlightedIndex.value + matchingSkills.value.length - 1) % matchingSkills.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const selected = matchingSkills.value[skillHighlightedIndex.value]
      if (selected) {
        event.preventDefault()
        applySkillMention(selected)
        return
      }
    }
  }

  if (isFileMentionOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeFileMention()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (fileMentionSuggestions.value.length > 0) {
        fileMentionHighlightedIndex.value =
          (fileMentionHighlightedIndex.value + 1) % fileMentionSuggestions.value.length
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (fileMentionSuggestions.value.length > 0) {
        const size = fileMentionSuggestions.value.length
        fileMentionHighlightedIndex.value = (fileMentionHighlightedIndex.value + size - 1) % size
      }
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const selected = fileMentionSuggestions.value[fileMentionHighlightedIndex.value]
      if (selected) {
        applyFileMention(selected)
      } else {
        closeFileMention()
      }
      return
    }
  }

  const shouldSend = props.sendWithEnter !== false
    ? event.key === 'Enter' && !event.shiftKey
    : event.key === 'Enter' && (event.metaKey || event.ctrlKey)
  if (shouldSend) {
    event.preventDefault()
    onSubmit(props.isTurnInProgress ? activeInProgressMode.value : 'steer')
    return
  }
}

function closeFileMention(): void {
  isFileMentionOpen.value = false
  isMentionDrivenAttachMenu.value = false
  isAttachMenuOpen.value = false
  mentionStartIndex.value = null
  mentionQuery.value = ''
  fileMentionSuggestions.value = []
  fileMentionHighlightedIndex.value = 0
}

function updateFileMentionState(context = inputRef.value?.getSelectionContext() ?? null): void {
  const input = inputRef.value
  if (!input || !context) {
    closeFileMention()
    return
  }
  const match = context.textBeforeCursor.match(/(^|\s)(@[^\s@]*)$/)
  if (!match) {
    closeFileMention()
    return
  }

  const mentionToken = match[2] ?? ''
  const mentionOffset = mentionToken.length
  const startIndex = context.from - mentionOffset
  mentionStartIndex.value = startIndex
  mentionQuery.value = mentionToken.slice(1)
  isFileMentionOpen.value = true
  isMentionDrivenAttachMenu.value = true
  isAttachMenuOpen.value = true
  void loadComposerPlugins()
  void loadChatGptConversations()
  void queueFileMentionSearch()
}

function matchesMentionQuery(...values: string[]): boolean {
  if (!isUnifiedAttachMenu.value) return true
  const query = mentionQuery.value.trim().toLowerCase()
  if (!query) return true
  return values.some((value) => value.toLowerCase().includes(query))
}

function consumeMentionToken(): void {
  if (!isMentionDrivenAttachMenu.value) return
  const input = inputRef.value
  const start = mentionStartIndex.value
  const context = input?.getSelectionContext() ?? lastComposerSelectionContext.value
  if (input && start !== null && context) {
    input.replaceRangeWithText(start, context.from, '')
  }
  closeFileMention()
}

async function queueFileMentionSearch(): Promise<void> {
  if (!isFileMentionOpen.value) return
  const cwd = (props.cwd ?? '').trim()
  if (!cwd) {
    fileMentionSuggestions.value = []
    return
  }
  if (fileMentionDebounceTimer) {
    clearTimeout(fileMentionDebounceTimer)
  }
  const token = ++fileMentionSearchToken
  fileMentionDebounceTimer = setTimeout(async () => {
    try {
      const rows = await searchComposerFiles(cwd, mentionQuery.value, 20)
      if (!isFileMentionOpen.value || token !== fileMentionSearchToken) return
      fileMentionSuggestions.value = rows
      fileMentionHighlightedIndex.value = 0
    } catch {
      if (!isFileMentionOpen.value || token !== fileMentionSearchToken) return
      fileMentionSuggestions.value = []
    }
  }, 120)
}

function applyFileMention(suggestion: ComposerFileSuggestion): void {
  const input = inputRef.value
  const start = mentionStartIndex.value
  const context = input?.getSelectionContext() ?? lastComposerSelectionContext.value
  if (start !== null && input && context) {
    input.replaceRangeWithText(start, context.from, '')
  }
  addFileAttachment(suggestion.path)
  closeFileMention()
  isAttachMenuOpen.value = false
  nextTick(() => input?.focus())
}

function closeSkillPicker(): void {
  isSkillPickerOpen.value = false
  skillMentionStartIndex.value = null
  skillQuery.value = ''
  skillHighlightedIndex.value = 0
}

function updateSkillMentionState(context = inputRef.value?.getSelectionContext() ?? null): void {
  const input = inputRef.value
  if (!input || !context || (props.skills?.length ?? 0) === 0) {
    closeSkillPicker()
    return
  }
  const match = context.textBeforeCursor.match(/(^|\s)(\$[^\s$]*)$/)
  if (!match) {
    closeSkillPicker()
    return
  }
  const token = match[2] ?? ''
  skillMentionStartIndex.value = context.from - token.length
  skillQuery.value = token.slice(1)
  skillHighlightedIndex.value = 0
  isSkillPickerOpen.value = true
}

function applySkillMention(skill: SkillItem): void {
  const input = inputRef.value
  const start = skillMentionStartIndex.value
  if (start === null || !input) return
  const context = input.getSelectionContext() ?? lastComposerSelectionContext.value
  if (!context) return
  const marker = `$${skill.name}`
  input.replaceRangeWithText(start, context.from, marker)
  if (!selectedSkills.value.some((item) => item.path === skill.path)) {
    selectedSkills.value = [...selectedSkills.value, skill]
  }
  closeSkillPicker()
  nextTick(() => input.focus())
}

function hydrateDraft(payload: ComposerDraftPayload): void {
  cancelDictation()
  replaceDraftState(payload)
  void nextTick(() => {
    inputRef.value?.focus()
    updateComposerOverflowState()
  })
}

function focusInput(): void {
  void nextTick(() => inputRef.value?.focus())
}

function appendTextToDraft(text: string): void {
  const nextText = text.trim()
  if (!nextText) return
  cancelDictation()
  if (draft.value.trim().length > 0) {
    draft.value = `${draft.value.trimEnd()}\n${nextText}`
  } else {
    draft.value = nextText
  }
  nextTick(() => inputRef.value?.focus())
}

function getMentionFileName(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return path
  return path.slice(idx + 1)
}

function getMentionDirName(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx <= 0) return ''
  return path.slice(0, idx)
}

function getFileExtension(path: string): string {
  const base = getMentionFileName(path)
  const idx = base.lastIndexOf('.')
  if (idx <= 0) return ''
  return base.slice(idx + 1).toLowerCase()
}

function getMentionBadgeText(path: string): string {
  const ext = getFileExtension(path)
  if (ext === 'ts') return 'TS'
  if (ext === 'tsx') return 'TSX'
  if (ext === 'js') return 'JS'
  if (ext === 'jsx') return 'JSX'
  if (ext === 'json') return '{}'
  return ''
}

function getMentionBadgeClass(path: string): string {
  const ext = getFileExtension(path)
  if (ext.startsWith('ts')) return 'ts'
  if (ext.startsWith('js')) return 'js'
  if (ext === 'json') return 'json'
  return 'default'
}

function isMarkdownFile(path: string): boolean {
  const ext = getFileExtension(path)
  return ext === 'md' || ext === 'mdx'
}

function onDocumentClick(event: MouseEvent): void {
  if (!isAttachMenuOpen.value) return
  const root = attachMenuRootRef.value
  if (!root) return
  const target = event.target as Node | null
  if (!target || root.contains(target)) return
  isAttachMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('drop', onWindowDragCleanup)
  window.addEventListener('dragend', onWindowDragCleanup)
  window.addEventListener('blur', onWindowDragCleanup)
  queueComposerOverflowMeasurement()
})

defineExpose<ThreadComposerExposed>({
  hydrateDraft,
  appendTextToDraft,
  focusInput,
  hasUnsavedDraft: () => hasUnsavedDraft.value,
  completeSubmission,
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('drop', onWindowDragCleanup)
  window.removeEventListener('dragend', onWindowDragCleanup)
  window.removeEventListener('blur', onWindowDragCleanup)
  window.removeEventListener('pointerup', onDictationPressEnd)
  window.removeEventListener('pointercancel', onDictationPressEnd)
  window.removeEventListener('blur', onDictationPressEnd)
  if (fileMentionDebounceTimer) {
    clearTimeout(fileMentionDebounceTimer)
  }
  if (typeof document !== 'undefined' && isComposerExpanded.value) {
    document.body.style.overflow = bodyOverflowBeforeExpansion
  }
})

watch(
  () => props.activeThreadId,
  (nextThreadId) => {
    cancelDictation()
    if (lastActiveThreadId) {
      persistDraftForThread(lastActiveThreadId, getCurrentDraftPayload())
    }
    clearDraftState()
    const restored = loadPersistedDraftForThread(nextThreadId)
    if (restored) {
      replaceDraftState(restored)
      onInputChange()
    }
    lastActiveThreadId = nextThreadId.trim()
  },
  { immediate: true },
)

watch([draft, selectedImages, fileAttachments, selectedSkills], () => {
  if (!lastActiveThreadId) return
  persistDraftForThread(lastActiveThreadId, getCurrentDraftPayload())
}, { deep: true })

watch(draft, () => {
  slashCommandHighlightedIndex.value = 0
  queueComposerOverflowMeasurement()
})

watch(isComposerExpanded, (expanded) => {
  if (typeof document === 'undefined') return
  if (expanded) {
    bodyOverflowBeforeExpansion = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = bodyOverflowBeforeExpansion
})

watch(
  () => props.cwd,
  () => {
    if (isFileMentionOpen.value) {
      void queueFileMentionSearch()
    }
  },
)

watch(
  inProgressMode,
  (nextMode) => {
    activeInProgressMode.value = nextMode
  },
)


</script>

<style scoped>
@reference "tailwindcss";

.thread-composer {
  @apply w-full max-w-[min(var(--chat-column-max,72rem),100%)] mx-auto;
}

.thread-composer--expanded {
  @apply fixed inset-0 z-[300] max-w-none bg-white/95;
  height: 100dvh;
  padding-top: max(0.75rem, env(safe-area-inset-top));
  padding-right: max(0.75rem, env(safe-area-inset-right));
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  padding-left: max(0.75rem, env(safe-area-inset-left));
}

.thread-composer-shell {
  @apply relative rounded-2xl border border-zinc-300 bg-white p-2 sm:p-3 shadow-sm;
}

.thread-composer--expanded .thread-composer-shell {
  @apply mx-auto flex h-full min-h-0 w-full max-w-[min(var(--chat-column-max,72rem),100%)] flex-col overflow-hidden shadow-2xl;
}

.thread-composer-shell--drag-active {
  @apply border-zinc-900 shadow-md;
}

.thread-composer-shell--no-top-radius {
  @apply rounded-t-none border-t-0;
}

.thread-composer-attachments {
  @apply mb-2 flex flex-wrap gap-2;
}

.thread-composer-draft-context {
  @apply shrink-0;
}

.thread-composer--expanded .thread-composer-draft-context {
  @apply mb-2 max-h-[min(28dvh,12rem)] overflow-y-auto;
}

.thread-composer-attachment {
  @apply relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50;
}

.thread-composer-attachment-image {
  @apply h-full w-full object-cover;
}

.thread-composer-attachment-remove {
  @apply absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-0 bg-black/70 text-xs leading-none text-white;
}

.thread-composer-file-chips {
  @apply mb-2 flex flex-wrap gap-1.5;
}

.thread-composer-folder-chips {
  @apply mb-2 flex flex-wrap gap-1.5;
}

.thread-composer-folder-chip {
  @apply inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800;
}

.thread-composer-folder-chip-icon {
  @apply h-3.5 w-3.5 text-amber-600 shrink-0;
}

.thread-composer-folder-chip-name {
  @apply truncate max-w-40 font-medium;
}

.thread-composer-folder-chip-meta {
  @apply text-amber-700/90;
}

.thread-composer-folder-chip-remove {
  @apply ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-0 bg-transparent text-amber-600 transition hover:bg-amber-200 hover:text-amber-800 text-xs leading-none p-0;
}

.thread-composer-file-chip {
  @apply inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700;
}

.thread-composer-file-chip-icon {
  @apply h-3.5 w-3.5 text-zinc-400 shrink-0;
}

.thread-composer-file-chip-name {
  @apply truncate max-w-40 font-mono;
}

.thread-composer-file-chip-remove {
  @apply ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-0 bg-transparent text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 text-xs leading-none p-0;
}

.thread-composer-skill-chips {
  @apply mb-2 flex flex-wrap gap-1.5;
}

.thread-composer-skill-chip {
  @apply inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700;
}

.thread-composer-skill-chip-name {
  @apply min-w-0 max-w-[12rem] truncate border-0 bg-transparent p-0 text-left font-medium text-inherit underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500;
}

.thread-composer-skill-chip-remove {
  @apply ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-0 bg-transparent text-emerald-500 transition hover:bg-emerald-200 hover:text-emerald-700 text-xs leading-none p-0;
}

.thread-composer-rate-limit {
  @apply mb-1.5 px-1 text-[11px] leading-5 text-zinc-500;
}

.thread-composer-rate-limit-row {
  @apply flex min-w-0 items-center gap-x-1.5 gap-y-1;
}

.thread-composer-rate-limit-value {
  @apply min-w-0 flex-1 truncate;
}

.thread-composer-input-wrap {
  @apply relative;
}

.thread-composer-input-wrap--expanded {
  @apply min-h-0 flex-1;
}

.thread-composer-input-wrap--drag-active {
  @apply rounded-xl bg-zinc-50;
}

.thread-composer-drop-overlay {
  @apply pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border border-dashed border-zinc-900 bg-white/90;
}

.thread-composer-drop-overlay-copy {
  @apply rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white shadow-sm;
}

.thread-composer-file-mentions {
  @apply absolute left-0 right-0 bottom-[calc(100%+8px)] z-40 max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg;
}

.thread-composer-slash-commands {
  @apply absolute left-0 right-0 bottom-[calc(100%+8px)] z-40 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900;
}

.thread-composer--expanded .thread-composer-slash-commands {
  @apply bottom-auto top-0;
}

.thread-composer-slash-command-row {
  @apply flex w-full items-start gap-3 rounded-lg border-0 bg-transparent px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800;
}

.thread-composer-slash-command-row.is-active {
  @apply bg-zinc-100 dark:bg-zinc-800;
}

.thread-composer-slash-command-name {
  @apply min-w-16 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100;
}

.thread-composer-slash-command-description {
  @apply min-w-0 flex-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400;
}

.thread-composer-review-choices {
  @apply absolute left-0 right-0 bottom-[calc(100%+8px)] z-40 flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100;
}

.thread-composer--expanded .thread-composer-review-choices { @apply bottom-auto top-0; }
.thread-composer-review-heading { @apply flex items-center justify-between; }
.thread-composer-review-heading button { @apply rounded px-2 py-1 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800; }
.thread-composer-review-choice { @apply flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-2 text-left dark:border-zinc-700; }
button.thread-composer-review-choice { @apply hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800; }
.thread-composer-review-choice label { @apply w-full text-xs text-zinc-500 dark:text-zinc-400; }
.thread-composer-review-choice input { @apply min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800; }
.thread-composer-review-choice button { @apply rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-40 dark:bg-zinc-200 dark:text-zinc-900; }

.thread-composer-file-mention-row {
  @apply flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-zinc-100;
}

.thread-composer-file-mention-row.is-active {
  @apply bg-zinc-100;
}

.thread-composer-file-mention-icon-badge {
  @apply inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-semibold leading-none;
}

.thread-composer-file-mention-icon-badge.is-ts {
  @apply bg-zinc-700 text-white;
}

.thread-composer-file-mention-icon-badge.is-js {
  @apply bg-zinc-600 text-white;
}

.thread-composer-file-mention-icon-badge.is-json {
  @apply bg-zinc-600 text-white;
}

.thread-composer-file-mention-icon-markdown {
  @apply inline-flex h-5 min-w-5 items-center justify-center text-sm leading-none text-zinc-700;
}

.thread-composer-file-mention-icon-file {
  @apply h-4 w-4 text-zinc-600;
}

.thread-composer-file-mention-text {
  @apply min-w-0 flex items-baseline gap-2;
}

.thread-composer-file-mention-name {
  @apply truncate text-zinc-900;
}

.thread-composer-file-mention-dir {
  @apply truncate text-zinc-400;
}

.thread-composer-file-mention-empty {
  @apply px-2 py-1.5 text-xs text-zinc-500;
}

.thread-composer-expand {
  @apply absolute right-0.5 top-0.5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-500 shadow-sm transition hover:bg-zinc-200 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400;
}

.thread-composer-expand-icon {
  @apply h-[18px] w-[18px];
}

.thread-composer-controls {
  @apply mt-2 sm:mt-3 flex items-center gap-2 sm:gap-4 overflow-visible pb-px;
}

.thread-composer-controls--recording {
  @apply gap-1 sm:gap-2;
}

.thread-composer-attach {
  @apply shrink-0;
}

.thread-composer-attach-trigger {
  @apply inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-none border-0 bg-transparent pb-px text-xl leading-tight text-zinc-700 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400;
}

.thread-composer-attach-menu {
  @apply absolute bottom-[calc(100%+8px)] left-0 z-40 w-full;
}

.thread-composer-attach-item {
  @apply block w-full rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400;
}

.thread-composer-attach-plan-item {
  @apply flex items-center gap-2;
}

.thread-composer-attach-plan-icon {
  @apply h-5 w-5 shrink-0 text-zinc-600;
}

.thread-composer-attach-plan-copy {
  @apply flex min-w-0 items-baseline gap-2;
}

.thread-composer-attach-plan-copy small {
  @apply truncate text-xs text-zinc-500;
}

.thread-composer-attach-separator {
  @apply my-1 h-px bg-zinc-100;
}

.thread-composer-attach-section-label {
  @apply px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500;
}

.thread-composer-attach-loading {
  @apply px-3 py-2 text-sm text-zinc-500;
}

.thread-composer-attach-error {
  @apply flex items-start justify-between gap-3 px-3 py-2 text-xs text-red-600;
}

.thread-composer-attach-error button {
  @apply shrink-0 rounded-full border border-red-200 px-2.5 py-1 font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50;
}

.thread-composer-attach-plugin {
  @apply flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50;
}

.thread-composer-attach-plugin-icon {
  @apply h-6 w-6 shrink-0 rounded-md object-contain;
}

.thread-composer-attach-plugin-icon.is-fallback {
  @apply inline-flex items-center justify-center bg-zinc-200 text-xs font-semibold text-zinc-700;
}

.thread-composer-attach-plugin-icon.is-chatgpt {
  @apply inline-flex items-center justify-center rounded-full border border-zinc-300 text-base leading-none text-zinc-500;
}

.thread-composer-attach-plugin-copy {
  @apply flex min-w-0 flex-col;
}

.thread-composer-attach-plugin-name {
  @apply truncate text-sm text-zinc-800;
}

.thread-composer-attach-plugin-description {
  @apply truncate text-xs text-zinc-500;
}

.thread-composer-attach-setting {
  @apply flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent px-3 py-2 text-left transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400;
}

.thread-composer-attach-setting-copy {
  @apply min-w-0 flex flex-col;
}

.thread-composer-attach-setting-label {
  @apply text-sm text-zinc-800;
}

.thread-composer-attach-setting-description {
  @apply mt-0.5 text-xs text-zinc-500;
}

.thread-composer-attach-switch {
  @apply relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors;
}

.thread-composer-attach-switch::after {
  content: '';
  @apply absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm;
}

.thread-composer-attach-switch.is-on {
  @apply bg-emerald-600;
}

.thread-composer-attach-switch.is-on::after {
  transform: translateX(16px);
}

.thread-composer-attach-switch.is-busy {
  @apply opacity-70;
}

.thread-composer-attach-switch.is-disabled {
  @apply opacity-50;
}

.thread-composer-control {
  @apply shrink-1 min-w-0;
}

.thread-composer-config-controls {
  @apply flex min-w-0 items-center gap-2 sm:gap-4;
}

.thread-composer-desktop-permissions {
  @apply shrink-0;
}

.thread-composer-mobile-permissions {
  display: none;
}

.thread-composer-mobile-leading-controls {
  display: none;
}

.thread-composer-model-context {
  @apply ml-auto flex min-w-0 items-center gap-3;
}

.thread-composer-context-ring {
  --context-usage-accent: rgb(82 82 91);
  @apply relative inline-flex h-5 w-5 shrink-0 cursor-default items-center justify-center outline-none;
}

.thread-composer-context-ring.is-warning {
  --context-usage-accent: rgb(217 119 6);
}

.thread-composer-context-ring.is-danger {
  --context-usage-accent: rgb(220 38 38);
}

.thread-composer-context-ring-track {
  @apply absolute inset-0 rounded-full;
  background: conic-gradient(var(--context-usage-accent) calc(var(--context-usage-percent) * 1%), rgb(228 228 231) 0);
}

.thread-composer-context-ring-track::after {
  content: '';
  @apply absolute inset-[3px] rounded-full bg-white;
}

.thread-composer-context-tooltip {
  @apply pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-50 hidden w-max max-w-[18rem] rounded-2xl bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-xl;
}

.thread-composer-context-tooltip-label,
.thread-composer-context-tooltip strong,
.thread-composer-context-tooltip span:last-child {
  @apply block;
}

.thread-composer-context-tooltip-label {
  @apply mb-1 text-zinc-300;
}

.thread-composer-context-tooltip strong {
  @apply text-base font-medium;
}

.thread-composer-context-tooltip span:last-child {
  @apply mt-1 text-zinc-200;
}

.thread-composer-context-ring:hover .thread-composer-context-tooltip,
.thread-composer-context-ring:focus-visible .thread-composer-context-tooltip {
  @apply block;
}

.thread-composer-plan-toggle {
  @apply inline-flex shrink-0 items-center gap-1 border-0 border-l border-zinc-200 bg-transparent pl-2 text-sm text-zinc-700 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400;
}

.thread-composer-plan-toggle-icon {
  @apply h-4 w-4;
}

.thread-composer-control :deep(.composer-dropdown-value) {
  @apply truncate;
}

.thread-composer-thinking-control :deep(.composer-dropdown-options) {
  @apply max-h-64;
}

.thread-composer-actions {
  @apply flex min-w-0 items-center gap-2;
}

.thread-composer-actions--recording {
  @apply ml-0 flex-1;
}

@media (max-width: 639px) {
  .thread-composer-shell {
    @apply grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-2 gap-y-2 border-0 bg-transparent p-0 shadow-none;
  }

  .thread-composer-draft-context {
    @apply col-span-full min-w-0;
  }

  .thread-composer-attachments {
    @apply mb-0 grid grid-cols-3 gap-2;
  }

  .thread-composer-folder-chips,
  .thread-composer-file-chips,
  .thread-composer-skill-chips {
    @apply col-span-full mb-0;
  }

  .thread-composer-attachment {
    @apply aspect-square h-auto w-auto;
  }

  .thread-composer-input-wrap {
    @apply order-3 col-start-2 min-w-0 self-end border border-zinc-200 bg-zinc-100;
    border-radius: 22px;
  }

  .thread-composer-controls {
    display: contents;
  }

  .thread-composer-attach {
    @apply order-2 col-start-1 self-center;
  }

  .thread-composer-attach-trigger {
    @apply h-11 w-11 rounded-full border border-zinc-200 bg-zinc-100 text-2xl text-zinc-700 hover:bg-zinc-200;
  }

  .thread-composer-config-controls {
    @apply order-1 col-span-full flex-nowrap gap-1.5 overflow-x-auto px-0.5;
    scrollbar-width: none;
  }

  .thread-composer-config-controls::-webkit-scrollbar {
    display: none;
  }

  .thread-composer-control {
    @apply min-w-0 shrink-0;
  }

  .thread-composer-mobile-permissions {
    display: block;
  }

  .thread-composer-mobile-leading-controls {
    @apply flex min-w-0 items-center gap-2;
  }

  .thread-composer-model-context {
    @apply order-1 col-span-full ml-0 justify-between;
  }

  .thread-composer-context-ring {
    display: none;
  }

  .thread-composer-control :deep(.composer-dropdown-trigger),
  .thread-composer-control :deep(.model-settings-trigger),
  .thread-composer-control :deep(.search-dropdown-trigger),
  .thread-composer-control :deep(.permissions-dropdown-trigger) {
    @apply min-h-9 max-w-[12rem] rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900;
  }

  .thread-composer-actions {
    @apply order-4 col-start-3 ml-0 self-center gap-1;
  }

  .thread-composer-mic,
  .thread-composer-submit,
  .thread-composer-stop {
    height: 2.75rem;
    width: 2.75rem;
  }

  .thread-composer-submit:disabled {
    display: none;
  }

  .thread-composer-actions:has(.thread-composer-submit:not(:disabled)) .thread-composer-mic {
    display: none;
  }

  .thread-composer--expanded .thread-composer-shell {
    @apply flex border border-zinc-300 bg-white p-3;
  }

  .thread-composer--expanded .thread-composer-controls {
    @apply flex;
  }

  .thread-composer--expanded .thread-composer-input-wrap {
    @apply order-none border-0 bg-transparent;
  }

  .thread-composer--expanded .thread-composer-attach,
  .thread-composer--expanded .thread-composer-config-controls,
  .thread-composer--expanded .thread-composer-model-context,
  .thread-composer--expanded .thread-composer-actions {
    @apply order-none;
  }
}

.thread-composer-mic {
  @apply inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400;
  touch-action: none;
}

.thread-composer-mic--active {
  @apply bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700;
}

.thread-composer-mic-icon {
  @apply h-5 w-5;
}

.thread-composer-dictation-waveform-wrap {
  @apply min-w-0 flex-1;
}

.thread-composer-dictation-waveform {
  @apply block h-9 w-full text-zinc-500;
}

.thread-composer-dictation-timer {
  @apply shrink-0 text-sm text-zinc-500 tabular-nums;
}

.thread-composer-dictation-error {
  @apply mb-2 px-1 text-xs text-amber-700;
}

.thread-composer-attachment-feedback {
  @apply mt-2 px-1 text-xs text-zinc-500;
}

.thread-composer-submit {
  @apply inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-zinc-900 text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500;
}

.thread-composer-submit--queue {
  @apply bg-amber-600 hover:bg-amber-700;
}

.thread-composer-submit-icon {
  @apply h-5 w-5;
}

.thread-composer-stop {
  @apply inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-zinc-900 text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500;
}

.thread-composer-stop-icon {
  @apply h-5 w-5;
}

.thread-composer-stop-spinner {
  @apply h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin;
}

.thread-composer-hidden-input {
  @apply hidden;
}
</style>
