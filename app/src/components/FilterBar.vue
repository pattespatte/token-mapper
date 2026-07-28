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
import type { DiffBucket } from '@dtcg-mapper/core'

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
  <div class="dtm-filterbar" role="group" aria-label="Filter comparison results">
    <button
      v-for="opt in options()"
      :key="opt.value"
      type="button"
      class="dtm-filterbar__button"
      :class="{
        'dtm-filterbar__button--active': activeFilter === opt.value,
        [`dtm-filterbar__button--${opt.value}`]: activeFilter === opt.value,
      }"
      :aria-pressed="activeFilter === opt.value"
      @click="setFilter(opt.value)"
    >
      <span class="dtm-filterbar__label">{{ opt.label }}</span>
      <span class="dtm-filterbar__count">{{ opt.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.dtm-filterbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dtm-spacing-xs);
  align-items: center;
}

.dtm-filterbar__button {
  display: inline-flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
  color: var(--dtm-color-text);
  font-size: var(--dtm-font-size-sm);
  cursor: pointer;
}

.dtm-filterbar__button:hover:not(.dtm-filterbar__button--active) {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1).
     Excludes --active, whose white-on-color treatment shouldn't be overridden. */
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-filterbar__button--active {
  color: #ffffff;
  border-color: transparent;
}

/* Active-state colours match DiffBadge for consistency. */
/*
 * "All" uses --dtm-color-text as its background, which in dark mode is
 * near-white (#f5f5f5) — so the default #ffffff active text is invisible
 * against it. Override to --dtm-color-bg, which is the page background and
 * thus inverts with the theme: white in light mode (#ffffff text still
 * reads on the dark --dtm-color-text), dark in dark mode (#0a0d12 text on
 * the near-white background). The semantic buckets keep #ffffff since their
 * saturated backgrounds stay distinct in both modes.
 */
.dtm-filterbar__button--all.dtm-filterbar__button--active {
  background-color: var(--dtm-color-text);
  color: var(--dtm-color-bg);
}

.dtm-filterbar__button--matching.dtm-filterbar__button--active {
  background-color: var(--dtm-color-success);
}

.dtm-filterbar__button--changed.dtm-filterbar__button--active {
  background-color: var(--dtm-color-warning);
}

.dtm-filterbar__button--missing.dtm-filterbar__button--active {
  background-color: var(--dtm-color-error);
}

.dtm-filterbar__button--extra.dtm-filterbar__button--active {
  background-color: var(--dtm-color-info);
}

.dtm-filterbar__count {
  padding: 0 var(--dtm-spacing-xs);
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: var(--dtm-radius-sm);
  font-variant-numeric: tabular-nums;
  font-size: var(--dtm-font-size-sm);
}

/* When not active, the count badge needs a visible chip against the surface. */
.dtm-filterbar__button:not(.dtm-filterbar__button--active) .dtm-filterbar__count {
  background-color: var(--dtm-color-surface-muted);
  color: var(--dtm-color-text-subtle);
}
</style>
