<script setup lang="ts">
/**
 * FilterBar — diff-bucket filter controls for compare mode.
 *
 * Renders toggle buttons for All / Matching / Changed / Missing / Extra,
 * each with its count from useDiff.counts. Bound to useDiff.activeFilter.
 * Only rendered by the Gallery when both sets are loaded.
 *
 * Uses aria-pressed for the active button (these are toggle buttons, not a
 * radiogroup — multiple buckets could conceivably be selected later, and
 * aria-pressed fits the "one active at a time for now" semantics cleanly).
 */

import { useDiff } from '@/composables/useDiff'
import type { DiffBucket } from '@/types/diff'

const { activeFilter, counts } = useDiff()

type FilterOption = {
  value: 'all' | DiffBucket
  label: string
  count: number
}

/** Build the button list from the live counts. */
function options(): FilterOption[] {
  const c = counts.value
  return [
    { value: 'all', label: 'All', count: c.matching + c.changed + c.missing + c.extra },
    { value: 'matching', label: 'Matching', count: c.matching },
    { value: 'changed', label: 'Changed', count: c.changed },
    { value: 'missing', label: 'Missing in B', count: c.missing },
    { value: 'extra', label: 'Extra in B', count: c.extra },
  ]
}

function setFilter(value: 'all' | DiffBucket): void {
  activeFilter.value = value
}
</script>

<template>
  <div class="dtv-filterbar" role="group" aria-label="Filter comparison results">
    <button
      v-for="opt in options()"
      :key="opt.value"
      type="button"
      class="dtv-filterbar__button"
      :class="{
        'dtv-filterbar__button--active': activeFilter === opt.value,
        [`dtv-filterbar__button--${opt.value}`]: activeFilter === opt.value,
      }"
      :aria-pressed="activeFilter === opt.value"
      @click="setFilter(opt.value)"
    >
      <span class="dtv-filterbar__label">{{ opt.label }}</span>
      <span class="dtv-filterbar__count">{{ opt.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.dtv-filterbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  align-items: center;
}

.dtv-filterbar__button {
  display: inline-flex;
  align-items: center;
  gap: var(--dtv-spacing-xs);
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
  color: var(--dtv-color-text);
  font-size: var(--dtv-font-size-sm);
  cursor: pointer;
}

.dtv-filterbar__button:hover {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-filterbar__button--active {
  color: #ffffff;
  border-color: transparent;
}

/* Active-state colours match DiffBadge for consistency. */
.dtv-filterbar__button--all.dtv-filterbar__button--active {
  background-color: var(--dtv-color-text);
}

.dtv-filterbar__button--matching.dtv-filterbar__button--active {
  background-color: var(--dtv-color-success);
}

.dtv-filterbar__button--changed.dtv-filterbar__button--active {
  background-color: var(--dtv-color-warning);
}

.dtv-filterbar__button--missing.dtv-filterbar__button--active {
  background-color: var(--dtv-color-error);
}

.dtv-filterbar__button--extra.dtv-filterbar__button--active {
  background-color: var(--dtv-color-info);
}

.dtv-filterbar__count {
  padding: 0 var(--dtv-spacing-xs);
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: var(--dtv-radius-sm);
  font-variant-numeric: tabular-nums;
  font-size: var(--dtv-font-size-sm);
}

/* When not active, the count badge needs a visible chip against the surface. */
.dtv-filterbar__button:not(.dtv-filterbar__button--active) .dtv-filterbar__count {
  background-color: var(--dtv-color-surface-muted);
  color: var(--dtv-color-text-subtle);
}
</style>
