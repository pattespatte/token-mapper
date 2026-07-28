<script setup lang="ts">
/**
 * SearchBar — global substring search input.
 *
 * Bound to `useSearch().query` (the module singleton), so the same query
 * drives both browse-mode `useGallery.visibleTokens` and compare-mode
 * `useDiff.filteredDiff`. The component itself is stateless beyond that —
 * no props, no events; just a two-way binding to the shared query.
 *
 * Keyboard:
 *   - Esc clears the query (whether the input is focused or not).
 *   - `/` focuses the input from anywhere outside a text field (wired by the
 *     parent Gallery, not here, so the shortcut works regardless of focus).
 *
 * Accessibility: a visible `<label>` is wired via `for`/`id` so screen readers
 * announce the field purpose. The input is `type="search"` so browsers
 * surface the right keyboard affordances.
 */

import { computed } from 'vue'
import { useSearch } from '@/composables/useSearch'

const { query, clearInput } = useSearch()

const hasQuery = computed(() => query.value !== '')

/** Esc handler: clear the query, keep focus on the input. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (query.value === '') return
    event.preventDefault()
    clearInput()
  }
}
</script>

<template>
  <div class="dtm-searchbar">
    <label for="dtm-searchbar-input" class="dtm-searchbar__label">Search</label>
    <div class="dtm-searchbar__input-wrap">
      <span class="dtm-searchbar__icon" aria-hidden="true">⌕</span>
      <input
        id="dtm-searchbar-input"
        type="search"
        class="dtm-searchbar__input"
        placeholder="Search path, description, or value…"
        autocomplete="off"
        spellcheck="false"
        v-model="query"
        @keydown="onKeydown"
      />
      <button
        v-if="hasQuery"
        type="button"
        class="dtm-searchbar__clear"
        aria-label="Clear search"
        @click="clearInput"
      >✕</button>
    </div>
  </div>
</template>

<style scoped>
.dtm-searchbar {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dtm-searchbar__label {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  /* Visually hidden but available to assistive tech — the placeholder already
     communicates purpose visually, and a visible label would duplicate it. */
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

.dtm-searchbar__input-wrap {
  display: flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
}

.dtm-searchbar__input-wrap:focus-within {
  border-color: var(--dtm-color-accent);
}

.dtm-searchbar__icon {
  color: var(--dtm-color-text-subtle);
  font-size: var(--dtm-font-size-md);
  line-height: 1;
}

.dtm-searchbar__input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--dtm-color-text);
  font: inherit;
  font-size: var(--dtm-font-size-sm);
}

/* Hide the browser's built-in search clear button — we render our own so the
   affordance is consistent with the rest of the app. */
.dtm-searchbar__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.dtm-searchbar__clear {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--dtm-radius-sm);
  color: var(--dtm-color-text-subtle);
  cursor: pointer;
  font-size: var(--dtm-font-size-sm);
  line-height: 1;
}

.dtm-searchbar__clear:hover {
  color: var(--dtm-color-error);
  background-color: var(--dtm-color-surface-muted);
}
</style>
