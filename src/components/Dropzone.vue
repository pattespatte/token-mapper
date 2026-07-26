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
    class="dtv-dropzone"
    :class="{
      'dtv-dropzone--drag': isDragOver,
      'dtv-dropzone--loading': isLoading,
      'dtv-dropzone--loaded': currentSet !== null,
    }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <button
      type="button"
      class="dtv-dropzone__button"
      :aria-label="`Upload token files for Set ${setId} (${hint}). Activate to choose files.`"
      :disabled="isLoading"
      @click="openPicker"
    >
      <span class="dtv-dropzone__label">
        <span class="dtv-dropzone__slot">Set {{ setId }}</span>
        <span class="dtv-dropzone__hint">{{ hint }}</span>
      </span>

      <span v-if="currentSet === null && !isLoading" class="dtv-dropzone__empty">
        Drop JSON here or click to choose
      </span>

      <span v-else-if="isLoading" class="dtv-dropzone__loading" aria-live="polite">
        Loading…
      </span>

      <span v-else-if="currentSet !== null" class="dtv-dropzone__summary">
        <span class="dtv-dropzone__filename" :title="fileListTooltip">
          {{ fileListLabel }}
        </span>
        <span class="dtv-dropzone__count">{{ currentSet.tokens.size }} tokens</span>
        <span
          v-if="currentSet.validation.length > 0"
          class="dtv-dropzone__issues"
          :title="`${currentSet.validation.length} validation issue(s)`"
        >
          {{ currentSet.validation.length }} issue{{ currentSet.validation.length === 1 ? '' : 's' }}
        </span>
        <span class="dtv-dropzone__add-hint">+ Add files</span>
      </span>
    </button>

    <p v-if="errorMsg !== null" class="dtv-dropzone__error" role="alert">
      {{ errorMsg }}
    </p>

    <!-- Visually hidden file input; activated programmatically by the button
         above. Kept outside the button to avoid invalid HTML (input-in-button)
         and to satisfy the axe nested-interactive rule. -->
    <input
      ref="inputRef"
      type="file"
      accept="application/json,.json"
      multiple
      class="dtv-dropzone__input"
      :aria-label="`Choose JSON files for Set ${setId}`"
      tabindex="-1"
      @change="onInputChange"
    />
  </div>
</template>

<style scoped>
.dtv-dropzone {
  /* Outer drop target. Holds the visible border/dashed style and the drag
     state. The actual button (with keyboard focus and click) lives inside. */
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
  border: 2px dashed var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
  background-color: var(--dtv-color-surface);
  min-width: 200px;
  transition: border-color 0.15s, background-color 0.15s;
}

.dtv-dropzone--drag {
  border-color: var(--dtv-color-accent);
  background-color: var(--dtv-color-accent-muted);
}

.dtv-dropzone--loaded {
  border-style: solid;
  border-color: var(--dtv-color-border);
}

.dtv-dropzone__button {
  /* The button fills the dropzone so the whole region is clickable and
     keyboard-focusable as one interactive control. */
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
  align-items: flex-start;
  width: 100%;
  padding: var(--dtv-spacing-sm) var(--dtv-spacing-md);
  background: none;
  border: none;
  border-radius: var(--dtv-radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dtv-dropzone__button:hover:not(:disabled) {
  /* Lift hover affordance to the wrapper via parent selector. */
  outline: none;
}

.dtv-dropzone__button:focus-visible {
  outline: 2px solid var(--dtv-color-accent);
  outline-offset: -2px;
}

.dtv-dropzone__button:disabled {
  cursor: progress;
  opacity: 0.7;
}

/* When the button is hovered or focused, paint the wrapper border. */
.dtv-dropzone:has(.dtv-dropzone__button:hover:not(:disabled)),
.dtv-dropzone:has(.dtv-dropzone__button:focus-visible) {
  border-color: var(--dtv-color-accent);
}

.dtv-dropzone__label {
  display: flex;
  align-items: baseline;
  gap: var(--dtv-spacing-xs);
}

.dtv-dropzone__slot {
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text);
}

.dtv-dropzone__hint {
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}

.dtv-dropzone__empty,
.dtv-dropzone__loading {
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-muted);
}

.dtv-dropzone__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  align-items: baseline;
  font-size: var(--dtv-font-size-sm);
}

.dtv-dropzone__filename {
  font-family: var(--dtv-font-family-mono);
  color: var(--dtv-color-text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dtv-dropzone__count {
  color: var(--dtv-color-text-subtle);
}

.dtv-dropzone__issues {
  color: var(--dtv-color-warning);
  font-weight: var(--dtv-font-weight-medium);
}

.dtv-dropzone__add-hint {
  /* Visual hint that subsequent uploads append. Matches the hint colour so
     it doesn't compete with the filename/count for attention. */
  color: var(--dtv-color-text-subtle);
  font-size: var(--dtv-font-size-sm);
}

.dtv-dropzone__button:hover:not(:disabled) .dtv-dropzone__add-hint,
.dtv-dropzone__button:focus-visible .dtv-dropzone__add-hint {
  color: var(--dtv-color-accent);
}

.dtv-dropzone__error {
  margin: 0;
  padding: 0 var(--dtv-spacing-md) var(--dtv-spacing-xs);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-error);
}

.dtv-dropzone__input {
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
