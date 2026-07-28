<script setup lang="ts">
/**
 * Dropzone — single upload slot for one side of the comparison.
 *
 * Renders a labelled drop target plus a hidden file input. Supports both
 * drag-and-drop and click-to-choose. Uploads **append** to the slot's set,
 * so the canonical foundation.json + semantic.json workflow is: drop the
 * first file, then drop the second — they merge automatically. To start
 * over, use the ✕ clear button in the Toolbar.
 *
 * Two of these are rendered by the Toolbar (one for Set A, one for Set B) to
 * form the comparison upload UI.
 *
 * Keyboard accessibility: the labelled region is a real <button> — activating
 * it (click or Enter/Space) opens the file chooser. Drag events are a
 * progressive-enhancement layer on top.
 */

import { ref, computed } from 'vue'
import { useTokenSets } from '@/composables/useTokenSets'

const props = defineProps<{
  /** Which comparison slot this dropzone feeds. */
  setId: 'A' | 'B'
  /** Human-readable label for the slot (e.g. "your design system"). */
  hint: string
}>()

const { setA, setB, addFiles } = useTokenSets()

const inputRef = ref<HTMLInputElement | null>(null)
const isLoading = ref(false)
const errorMsg = ref<string | null>(null)
const isDragOver = ref(false)

/** The set currently loaded into this slot (or null). */
const currentSet = computed(() =>
  props.setId === 'A' ? setA.value : setB.value
)

/**
 * Short label for the loaded source list. 1 file → its name; 2+ files →
 * "first.json + N more". The full list lives in `sourceFiles` and shows as
 * a tooltip.
 */
const fileListLabel = computed<string>(() => {
  const names = currentSet.value?.sourceFiles ?? []
  if (names.length <= 1) return currentSet.value?.label ?? ''
  return `${names[0]} + ${names.length - 1} more`
})

const fileListTooltip = computed<string>(() => {
  const names = currentSet.value?.sourceFiles ?? []
  return names.join('\n')
})

/** Open the native file chooser. */
function openPicker(): void {
  errorMsg.value = null
  inputRef.value?.click()
}

/** Handle the file input's change event. */
async function onInputChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files === null || files.length === 0) return
  await handleFiles(Array.from(files))
  // Reset so picking the same file again still fires a change event.
  input.value = ''
}

/** Drag handlers — visual affordance only; the actual drop calls handleFiles. */
function onDragOver(event: DragEvent): void {
  // preventDefault is required to allow the drop event to fire.
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

function onDragLeave(): void {
  isDragOver.value = false
}

async function onDrop(event: DragEvent): Promise<void> {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  if (files === undefined || files.length === 0) return
  await handleFiles(Array.from(files))
}

/** Common path: run the pipeline and surface any thrown errors. */
async function handleFiles(files: File[]): Promise<void> {
  isLoading.value = true
  errorMsg.value = null
  try {
    await addFiles(props.setId, files)
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="dtm-dropzone"
    :class="{
      'dtm-dropzone--drag': isDragOver,
      'dtm-dropzone--loading': isLoading,
      'dtm-dropzone--loaded': currentSet !== null,
    }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <button
      type="button"
      class="dtm-dropzone__button"
      :aria-label="`Upload token files for Set ${setId} (${hint}). Activate to choose files.`"
      :disabled="isLoading"
      @click="openPicker"
    >
      <span class="dtm-dropzone__label">
        <span class="dtm-dropzone__slot">Set {{ setId }}</span>
        <span class="dtm-dropzone__hint">{{ hint }}</span>
      </span>

      <span v-if="currentSet === null && !isLoading" class="dtm-dropzone__empty">
        Drop JSON or CSS here or click to choose
      </span>

      <span v-else-if="isLoading" class="dtm-dropzone__loading" aria-live="polite">
        Loading…
      </span>

      <span v-else-if="currentSet !== null" class="dtm-dropzone__summary">
        <span class="dtm-dropzone__filename" :title="fileListTooltip">
          {{ fileListLabel }}
        </span>
        <span class="dtm-dropzone__count">{{ currentSet.tokens.size }} tokens</span>
        <span
          v-if="currentSet.validation.length > 0"
          class="dtm-dropzone__issues"
          :title="`${currentSet.validation.length} validation issue(s)`"
        >
          {{ currentSet.validation.length }} issue{{ currentSet.validation.length === 1 ? '' : 's' }}
        </span>
        <span class="dtm-dropzone__add-hint">+ Add files</span>
      </span>
    </button>

    <p v-if="errorMsg !== null" class="dtm-dropzone__error" role="alert">
      {{ errorMsg }}
    </p>

    <!-- Visually hidden file input; activated programmatically by the button
         above. Kept outside the button to avoid invalid HTML (input-in-button)
         and to satisfy the axe nested-interactive rule. -->
    <input
      ref="inputRef"
      type="file"
      accept=".json,.css,application/json,text/css"
      multiple
      class="dtm-dropzone__input"
      :aria-label="`Choose JSON or CSS files for Set ${setId}`"
      tabindex="-1"
      @change="onInputChange"
    />
  </div>
</template>

<style scoped>
.dtm-dropzone {
  /* Outer drop target. Holds the visible border/dashed style and the drag
     state. The actual button (with keyboard focus and click) lives inside. */
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  border: 2px dashed var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
  background-color: var(--dtm-color-surface);
  min-width: 200px;
  transition: border-color 0.15s, background-color 0.15s;
}

.dtm-dropzone--drag {
  border-color: var(--dtm-color-accent);
  background-color: var(--dtm-color-accent-muted);
}

.dtm-dropzone--loaded {
  border-style: solid;
  border-color: var(--dtm-color-border);
}

.dtm-dropzone__button {
  /* The button fills the dropzone so the whole region is clickable and
     keyboard-focusable as one interactive control. */
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  align-items: flex-start;
  width: 100%;
  padding: var(--dtm-spacing-sm) var(--dtm-spacing-md);
  background: none;
  border: none;
  border-radius: var(--dtm-radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dtm-dropzone__button:hover:not(:disabled) {
  /* Lift hover affordance to the wrapper via parent selector. */
  outline: none;
}

.dtm-dropzone__button:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: -2px;
}

.dtm-dropzone__button:disabled {
  cursor: progress;
  opacity: 0.7;
}

/* When the button is hovered or focused, paint the wrapper border. */
.dtm-dropzone:has(.dtm-dropzone__button:hover:not(:disabled)),
.dtm-dropzone:has(.dtm-dropzone__button:focus-visible) {
  border-color: var(--dtm-color-accent);
}

.dtm-dropzone__label {
  display: flex;
  align-items: baseline;
  gap: var(--dtm-spacing-xs);
}

.dtm-dropzone__slot {
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text);
}

.dtm-dropzone__hint {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}

.dtm-dropzone__empty,
.dtm-dropzone__loading {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-muted);
}

.dtm-dropzone__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dtm-spacing-xs);
  align-items: baseline;
  font-size: var(--dtm-font-size-sm);
}

.dtm-dropzone__filename {
  font-family: var(--dtm-font-family-mono);
  color: var(--dtm-color-text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dtm-dropzone__count {
  color: var(--dtm-color-text-subtle);
}

.dtm-dropzone__issues {
  color: var(--dtm-color-warning);
  font-weight: var(--dtm-font-weight-medium);
}

.dtm-dropzone__add-hint {
  /* Visual hint that subsequent uploads append. Matches the hint colour so
     it doesn't compete with the filename/count for attention. */
  color: var(--dtm-color-text-subtle);
  font-size: var(--dtm-font-size-sm);
}

.dtm-dropzone__button:hover:not(:disabled) .dtm-dropzone__add-hint,
.dtm-dropzone__button:focus-visible .dtm-dropzone__add-hint {
  color: var(--dtm-color-accent);
}

.dtm-dropzone__error {
  margin: 0;
  padding: 0 var(--dtm-spacing-md) var(--dtm-spacing-xs);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-error);
}

.dtm-dropzone__input {
  /* Visually hidden but accessible to the file chooser. */
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
