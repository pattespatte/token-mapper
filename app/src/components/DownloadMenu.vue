<script setup lang="ts">
/**
 * DownloadMenu — per-set DTCG JSON download controls.
 *
 * A small "↓ JSON" button that reveals a popover with two download options:
 *
 *   - Raw (keep references)  → `serializeTokens(set.tokens, { value: 'raw' })`
 *   - Resolved (literals)    → `serializeTokens(set.resolved, { value: 'resolved' })`
 *
 * The parent (Toolbar) gates rendering with `v-if` so the button only appears
 * when its slot is loaded. Reads set data from `useTokenSets` and serialises
 * via the core `serializeTokens` pure function.
 *
 * Filename: `${sanitizeFilename(set.label) || 'set-' + setId}.json`.
 *
 * Popover closes on item click or on an outside click (document listener).
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useTokenSets } from '@/composables/useTokenSets'
import { serializeTokens, type SerializeValue } from '@dtcg-mapper/core'
import { downloadTextFile, sanitizeFilename } from '@/utils/download'

const props = defineProps<{
  /** Which slot this menu controls. */
  setId: 'A' | 'B'
}>()

const { setA, setB } = useTokenSets()

/** Whether the popover panel is currently open. */
const open = ref(false)

/** The popover container element (for click-outside detection). */
const panelRef = ref<HTMLElement | null>(null)

/** Resolve the set for the current slot. */
function tokenSet() {
  return props.setId === 'A' ? setA.value : setB.value
}

/** Build the sanitised download filename for this set. */
function filename(): string {
  const label = tokenSet()?.label
  const stem = label ? sanitizeFilename(label) : ''
  return stem ? `${stem}.json` : `set-${props.setId}.json`
}

/**
 * Serialize the current set and trigger a download.
 *
 * @param mode - Which value form to emit.
 */
function download(mode: SerializeValue): void {
  const set = tokenSet()
  if (set === null) return

  const tokens =
    mode === 'resolved' ? set.resolved : set.tokens
  const json = serializeTokens(tokens, { value: mode })

  downloadTextFile(filename(), json, 'application/json')
  open.value = false
}

/** Close the popover. */
function close(): void {
  open.value = false
}

/** Toggle the popover open state. */
function toggle(): void {
  open.value = !open.value
}

/**
 * Click-outside handler: close the popover when the user clicks anywhere
 * outside the panel container.
 */
function onDocumentClick(event: MouseEvent): void {
  if (panelRef.value === null) return
  if (!panelRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div ref="panelRef" class="dtm-download-menu">
    <button
      type="button"
      class="dtm-download-menu__trigger"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="toggle"
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      JSON
    </button>

    <div
      v-if="open"
      class="dtm-download-menu__popover"
      role="menu"
    >
      <button
        type="button"
        class="dtm-download-menu__item"
        role="menuitem"
        @click="download('raw')"
      >
        Raw (keep references)
      </button>
      <button
        type="button"
        class="dtm-download-menu__item"
        role="menuitem"
        @click="download('resolved')"
      >
        Resolved (literals)
      </button>
    </div>
  </div>
</template>

<style scoped>
.dtm-download-menu {
  position: relative;
  display: inline-flex;
}

.dtm-download-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-medium);
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
  cursor: pointer;
  white-space: nowrap;
}

.dtm-download-menu__trigger:hover {
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-download-menu__trigger:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: 2px;
}

.dtm-download-menu__popover {
  position: absolute;
  top: calc(100% + var(--dtm-spacing-xs));
  right: 0;
  z-index: 20;
  min-width: 180px;
  padding: var(--dtm-spacing-xs);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dtm-download-menu__item {
  display: block;
  width: 100%;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text);
  background: none;
  border: none;
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
  text-align: left;
}

.dtm-download-menu__item:hover {
  background-color: var(--dtm-color-surface-muted);
}

.dtm-download-menu__item:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: -2px;
}
</style>
