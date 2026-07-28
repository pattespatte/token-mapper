<script setup lang="ts">
/**
 * Toolbar — top-of-content controls.
 *
 * Holds the two upload Dropzones (Set A, Set B), the "Load demo" button, the
 * "Clear all" button, and the ShareMenu (Copy link / Clear URL).
 * Shows a status line indicating browse vs compare mode based on whether both
 * slots are populated.
 *
 * The "mode toggle" mentioned in the plan is implicit rather than an explicit
 * switch: with one set loaded we're in browse mode, with two we're in compare
 * mode. Forcing this via an explicit toggle would be redundant state to keep
 * in sync — better to derive it from the sets themselves.
 */

import { useTokenSets } from '@/composables/useTokenSets'
import { usePersistence } from '@/composables/usePersistence'
import Dropzone from './Dropzone.vue'
import ShareMenu from './ShareMenu.vue'

const { loadDemo, clearSet, setA, setB } = useTokenSets()
const { clearState } = usePersistence()

/**
 * Clear both runtime slots and the persisted localStorage snapshot, so the
 * next session starts completely fresh — otherwise a reload would restore
 * the just-cleared data.
 *
 * Runtime state is cleared first; then storage. If the storage clear fails
 * (it won't — it's try/caught internally) the runtime is already clean, so
 * the user-visible outcome is still "everything is gone".
 */
function clearAll(): void {
  clearSet('A')
  clearSet('B')
  clearState()
}

/** Status message shown above the dropzones. */
function modeStatus(): string {
  if (setA.value !== null && setB.value !== null) {
    return 'Comparing set A and set B'
  }
  if (setA.value !== null) {
    return 'Browsing set A — load set B to compare'
  }
  if (setB.value !== null) {
    return 'Browsing set B — load set A to compare'
  }
  return 'Load a demo set or upload tokens to begin'
}
</script>

<template>
  <div class="dtv-toolbar">
    <div class="dtv-toolbar__actions">
      <button
        type="button"
        class="dtv-toolbar__button"
        @click="loadDemo"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
        </svg>
        Load demo
      </button>
      <button
        type="button"
        class="dtv-toolbar__button"
        :disabled="setA === null && setB === null"
        @click="clearAll"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        Clear all
      </button>
      <!--
        ShareMenu is always rendered (even with no sets loaded) so its
        buttons stay in a stable position. The "Load a set first" inline
        message handles the empty case; "Clear URL" auto-disables when
        there's no hash.
      -->
      <ShareMenu />
    </div>

    <p class="dtv-toolbar__status" aria-live="polite">
      {{ modeStatus() }}
    </p>

    <div class="dtv-toolbar__slots">
      <div class="dtv-toolbar__slot">
        <Dropzone set-id="A" hint="your design system" />
        <button
          v-if="setA !== null"
          type="button"
          class="dtv-toolbar__clear"
          aria-label="Clear set A"
          @click="clearSet('A')"
        >✕</button>
      </div>

      <div class="dtv-toolbar__slot">
        <Dropzone set-id="B" hint="base design system" />
        <button
          v-if="setB !== null"
          type="button"
          class="dtv-toolbar__clear"
          aria-label="Clear set B"
          @click="clearSet('B')"
        >✕</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dtv-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
  padding: var(--dtv-spacing-md);
  border-bottom: 1px solid var(--dtv-color-border);
  background-color: var(--dtv-color-surface);
}

.dtv-toolbar__actions {
  display: flex;
  gap: var(--dtv-spacing-xs);
}

.dtv-toolbar__button {
  display: inline-flex;
  align-items: center;
  gap: var(--dtv-spacing-xs);
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
  cursor: pointer;
}

.dtv-toolbar__button:hover:not(:disabled) {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1). */
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface-muted);
}

.dtv-toolbar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dtv-toolbar__status {
  margin: 0;
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}

.dtv-toolbar__slots {
  display: flex;
  gap: var(--dtv-spacing-md);
  flex-wrap: wrap;
}

.dtv-toolbar__slot {
  display: flex;
  align-items: stretch;
  gap: var(--dtv-spacing-xs);
  flex: 1 1 280px;
}

.dtv-toolbar__clear {
  padding: 0 var(--dtv-spacing-sm);
  font-size: var(--dtv-font-size-md);
  color: var(--dtv-color-text-subtle);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
  cursor: pointer;
}

.dtv-toolbar__clear:hover {
  color: var(--dtv-color-error);
  border-color: var(--dtv-color-error);
}
</style>
