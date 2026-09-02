<template>
  <div
    ref="hostRef"
    class="composer-rich-input"
    :class="{ 'is-disabled': disabled }"
    :data-placeholder="placeholder"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { baseKeymap } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { Schema, type DOMOutputSpec, type Node as ProseMirrorNode } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import {
  composerReferenceFromHref,
  composerReferenceHref,
  serializeComposerReference,
  type ComposerInlineReference,
} from '../../composerReferences'

export type { ComposerInlineReference } from '../../composerReferences'

export type ComposerSelectionContext = {
  from: number
  to: number
  textBeforeCursor: string
}

export type ComposerRichInputExposed = {
  focus: () => void
  blur: () => void
  getSelectionContext: () => ComposerSelectionContext | null
  replaceRangeWithReference: (from: number, to: number, reference: ComposerInlineReference) => void
  replaceRangeWithText: (from: number, to: number, text: string) => void
  setSelectionRange: (from: number, to: number) => void
  getScrollMetrics: () => { scrollHeight: number; clientHeight: number }
}

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [context: ComposerSelectionContext]
  keydown: [event: KeyboardEvent]
  paste: [event: ClipboardEvent]
  'references-change': [references: ComposerInlineReference[]]
}>()

const hostRef = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null
let lastSerializedValue = props.modelValue

function referenceDomSpec(node: ProseMirrorNode): DOMOutputSpec {
  const attrs = node.attrs as ComposerInlineReference
  const icon: DOMOutputSpec = attrs.kind === 'chatgpt-conversation'
    ? ['span', { class: 'composer-inline-reference-icon is-chatgpt', 'aria-hidden': 'true' }, '○']
    : attrs.iconSrc
      ? ['img', { class: 'composer-inline-reference-icon', src: attrs.iconSrc, alt: '' }]
      : ['span', { class: 'composer-inline-reference-icon is-fallback', 'aria-hidden': 'true' }, attrs.label.slice(0, 1)]
  return [
    'span',
    {
      class: `composer-inline-reference is-${attrs.kind}`,
      'data-composer-reference': attrs.kind,
      'data-reference-id': attrs.id,
      'data-reference-href': attrs.href,
      title: attrs.label,
    },
    icon,
    ['span', { class: 'composer-inline-reference-label' }, attrs.label],
  ]
}

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
    reference: {
      inline: true,
      group: 'inline',
      atom: true,
      selectable: true,
      attrs: {
        kind: {},
        id: {},
        label: {},
        href: {},
        iconSrc: { default: '' },
      },
      parseDOM: [{
        tag: '[data-composer-reference]',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) return false
          const kind = dom.dataset.composerReference
          const id = dom.dataset.referenceId
          const label = dom.textContent?.trim()
          if ((kind !== 'plugin' && kind !== 'chatgpt-conversation') || !id || !label) return false
          return {
            kind,
            id,
            label,
            href: composerReferenceHref(kind, id),
            iconSrc: '',
          }
        },
      }],
      toDOM: referenceDomSpec,
      leafText: (node) => ` ${String(node.attrs.label ?? '')} `,
    },
  },
  marks: {},
})

function serializeDocument(doc: ProseMirrorNode): string {
  const paragraphs: string[] = []
  doc.forEach((paragraph) => {
    let text = ''
    paragraph.forEach((node) => {
      if (node.isText) {
        text += node.text ?? ''
      } else if (node.type === schema.nodes.hard_break) {
        text += '\n'
      } else if (node.type === schema.nodes.reference) {
        text += serializeComposerReference({
          label: String(node.attrs.label ?? ''),
          href: String(node.attrs.href ?? ''),
        })
      }
    })
    paragraphs.push(text)
  })
  return paragraphs.join('\n')
}

function inlineNodesFromText(value: string): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = []
  const mentionPattern = /\[([^\]\n]+)\]\((chatgpt-conversation:\/\/[^)\s]+|plugin:\/\/[^)\s]+)\)/g
  let cursor = 0
  for (const match of value.matchAll(mentionPattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(schema.text(value.slice(cursor, index)))
    const reference = composerReferenceFromHref(match[1] ?? '', match[2] ?? '')
    if (reference) {
      nodes.push(schema.nodes.reference.create(reference))
    } else {
      nodes.push(schema.text(match[0]))
    }
    cursor = index + match[0].length
  }
  if (cursor < value.length) nodes.push(schema.text(value.slice(cursor)))
  return nodes
}

function documentFromText(value: string): ProseMirrorNode {
  const lines = value.split('\n')
  return schema.nodes.doc.create(
    null,
    lines.map((line) => schema.nodes.paragraph.create(null, inlineNodesFromText(line))),
  )
}

function collectReferences(doc: ProseMirrorNode): ComposerInlineReference[] {
  const references: ComposerInlineReference[] = []
  const seen = new Set<string>()
  doc.descendants((node) => {
    if (node.type !== schema.nodes.reference) return
    const reference = node.attrs as ComposerInlineReference
    const key = `${reference.kind}:${reference.id}`
    if (seen.has(key)) return
    seen.add(key)
    references.push({ ...reference })
  })
  return references
}

function selectionContext(view = editorView): ComposerSelectionContext | null {
  if (!view) return null
  const { from, to } = view.state.selection
  return {
    from,
    to,
    textBeforeCursor: view.state.doc.textBetween(0, from, '\n', ' '),
  }
}

function refreshEmptyState(view: EditorView): void {
  view.dom.classList.toggle('is-empty', serializeDocument(view.state.doc).length === 0)
}

function emitEditorState(view: EditorView): void {
  const serialized = serializeDocument(view.state.doc)
  lastSerializedValue = serialized
  if (serialized !== props.modelValue) emit('update:modelValue', serialized)
  emit('references-change', collectReferences(view.state.doc))
  const context = selectionContext(view)
  if (context) emit('input', context)
  refreshEmptyState(view)
}

function insertHardBreak(view: EditorView): boolean {
  const node = schema.nodes.hard_break.create()
  const transaction = view.state.tr.replaceSelectionWith(node).scrollIntoView()
  view.dispatch(transaction)
  return true
}

function createEditorState(value: string): EditorState {
  return EditorState.create({
    schema,
    doc: documentFromText(value),
    plugins: [
      history(),
      keymap({ 'Mod-z': undo, 'Shift-Mod-z': redo, 'Mod-y': redo }),
      keymap(baseKeymap),
    ],
  })
}

function focus(): void {
  editorView?.focus()
}

function blur(): void {
  if (editorView?.dom instanceof HTMLElement) editorView.dom.blur()
}

function replaceRangeWithReference(
  from: number,
  to: number,
  reference: ComposerInlineReference,
): void {
  const view = editorView
  if (!view) return
  const boundedFrom = Math.max(1, Math.min(from, view.state.doc.content.size - 1))
  const boundedTo = Math.max(boundedFrom, Math.min(to, view.state.doc.content.size - 1))
  const node = schema.nodes.reference.create(reference)
  let transaction = view.state.tr.replaceRangeWith(boundedFrom, boundedTo, node)
  const afterReference = boundedFrom + node.nodeSize
  transaction = transaction.insertText(' ', afterReference)
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, afterReference + 1)).scrollIntoView()
  view.dispatch(transaction)
  view.focus()
}

function replaceRangeWithText(from: number, to: number, text: string): void {
  const view = editorView
  if (!view) return
  const boundedFrom = Math.max(1, Math.min(from, view.state.doc.content.size - 1))
  const boundedTo = Math.max(boundedFrom, Math.min(to, view.state.doc.content.size - 1))
  let transaction = view.state.tr.insertText(text, boundedFrom, boundedTo)
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, boundedFrom + text.length)).scrollIntoView()
  view.dispatch(transaction)
  view.focus()
}

function setSelectionRange(from: number, to: number): void {
  const view = editorView
  if (!view) return
  const max = view.state.doc.content.size - 1
  const boundedFrom = Math.max(1, Math.min(from, max))
  const boundedTo = Math.max(boundedFrom, Math.min(to, max))
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, boundedFrom, boundedTo)))
}

function getScrollMetrics(): { scrollHeight: number; clientHeight: number } {
  const dom = editorView?.dom
  return {
    scrollHeight: dom?.scrollHeight ?? 0,
    clientHeight: dom?.clientHeight ?? 0,
  }
}

defineExpose<ComposerRichInputExposed>({
  focus,
  blur,
  getSelectionContext: () => selectionContext(),
  replaceRangeWithReference,
  replaceRangeWithText,
  setSelectionRange,
  getScrollMetrics,
})

onMounted(() => {
  if (!hostRef.value) return
  editorView = new EditorView(hostRef.value, {
    state: createEditorState(props.modelValue),
    editable: () => !props.disabled,
    attributes: {
      class: 'composer-rich-input-editor',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': props.placeholder || 'Message',
    },
    dispatchTransaction: (transaction) => {
      if (!editorView) return
      editorView.updateState(editorView.state.apply(transaction))
      emitEditorState(editorView)
    },
    handleKeyDown: (view, event) => {
      emit('keydown', event)
      if (event.defaultPrevented) return true
      if (event.key === 'Enter') return insertHardBreak(view)
      return false
    },
    handlePaste: (_view, event) => {
      emit('paste', event)
      return event.defaultPrevented
    },
  })
  lastSerializedValue = serializeDocument(editorView.state.doc)
  emitEditorState(editorView)
})

watch(() => props.modelValue, (value) => {
  const view = editorView
  if (!view || value === lastSerializedValue) return
  const nextState = createEditorState(value)
  const end = Math.max(1, nextState.doc.content.size - 1)
  view.updateState(nextState.apply(nextState.tr.setSelection(TextSelection.create(nextState.doc, end))))
  lastSerializedValue = value
  emitEditorState(view)
})

watch(() => props.disabled, () => {
  editorView?.setProps({ editable: () => !props.disabled })
})

watch(() => props.placeholder, (placeholder) => {
  editorView?.setProps({
    attributes: {
      class: 'composer-rich-input-editor',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': placeholder || 'Message',
    },
  })
})

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<style>
.composer-rich-input {
  width: 100%;
  min-width: 0;
  min-height: inherit;
}

.composer-rich-input-editor {
  min-height: 2.75rem;
  max-height: 10rem;
  overflow-y: auto;
  padding: 0.5rem 2.5rem 0.5rem 0.25rem;
  color: rgb(39 39 42);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  outline: none;
}

.composer-rich-input-editor p {
  min-height: 1.55em;
  margin: 0;
}

.composer-rich-input-editor.is-empty::before {
  position: absolute;
  color: rgb(161 161 170);
  content: attr(aria-label);
  pointer-events: none;
}

.composer-inline-reference {
  display: inline-flex;
  max-width: min(18rem, 72vw);
  align-items: center;
  gap: 0.3rem;
  margin: 0 0.1rem;
  padding: 0.08rem 0.4rem;
  border-radius: 0.4rem;
  color: rgb(194 65 12);
  background: rgb(255 247 237);
  box-decoration-break: clone;
  vertical-align: baseline;
  user-select: all;
}

.composer-inline-reference.ProseMirror-selectednode {
  box-shadow: 0 0 0 2px rgb(249 115 22 / 35%);
}

.composer-inline-reference-icon {
  width: 0.95rem;
  height: 0.95rem;
  flex: none;
  border-radius: 0.2rem;
  object-fit: contain;
}

.composer-inline-reference-icon.is-fallback,
.composer-inline-reference-icon.is-chatgpt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
}

.composer-inline-reference-icon.is-chatgpt {
  border: 1px solid currentColor;
  border-radius: 999px;
}

.composer-inline-reference-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-rich-input.is-disabled .composer-rich-input-editor {
  cursor: not-allowed;
  color: rgb(113 113 122);
}

.thread-composer-input-wrap--expanded .composer-rich-input,
.thread-composer-input-wrap--expanded .composer-rich-input-editor {
  height: 100%;
  max-height: none;
}

.thread-composer-input-wrap--expanded .composer-rich-input-editor {
  padding-right: 3rem;
  font-size: 1rem;
  line-height: 1.5rem;
}

:root.dark .composer-rich-input-editor {
  color: rgb(244 244 245);
}

:root.dark .composer-rich-input-editor.is-empty::before {
  color: rgb(113 113 122);
}

:root.dark .composer-inline-reference {
  color: rgb(253 186 116);
  background: rgb(124 45 18 / 45%);
}

@media (max-width: 639px) {
  .composer-rich-input-editor {
    min-height: 2.75rem;
    max-height: 8rem;
    padding: 0.625rem 2.25rem 0.625rem 0.75rem;
    font-size: 16px;
    line-height: 1.5rem;
  }
}
</style>
