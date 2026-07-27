<script setup lang="ts">
/**
 * Toolbar — top-of-content controls.
 *
 * Holds the two upload Dropzones (Set A, Set B), the "Load demo" button, and
 * per-slot clear buttons. Shows a status line indicating browse vs compare
 * mode based on whether both slots are populated.
 *
 * The "mode toggle" mentioned in the plan is implicit rather than an explicit
 * switch: with one set loaded we're in browse mode, with two we're in compare
 * mode. Forcing this via an explicit toggle would be redundant state to keep
 * in sync — better to derive it from the sets themselves.
 */

import { useTokenSets } from '@/composables/useTokenSets'
import Dropzone from './Dropzone.vue'

const { loadDemo, clearSet, setA, setB } = useTokenSets()

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
        class="dtv-toolbar__button dtv-toolbar__button--primary"
        @click="loadDemo"
      >
        Load demo
      </button>
      <button
        type="button"
        class="dtv-toolbar__button"
        :disabled="setA === null && setB === null"
        @click="() => { clearSet('A'); clearSet('B') }"
      >
        Clear all
      </button>
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
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
}

.dtv-toolbar__button:hover:not(:disabled) {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-toolbar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dtv-toolbar__button--primary {
  color: var(--dtv-color-bg);
  background-color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-toolbar__button--primary:hover:not(:disabled) {
  background-color: var(--dtv-color-accent);
  filter: brightness(1.1);
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
