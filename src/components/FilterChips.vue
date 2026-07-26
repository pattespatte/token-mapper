<script setup lang="ts">
/**
 * FilterChips — browse-mode facet toggles.
 *
 * Renders one toggle chip per `$type` present in the browse set, plus an
 * "other" chip (types without a dedicated renderer), plus `alias` and
 * `issues` facet chips. Counts on each chip reflect the **browse set's full
 * population** (from `useGallery().filterCounts`), not the active-filtered
 * view — so chips never vanish as you filter and the user can always click
 * their way back out (PRD decision #4).
 *
 * Compare-mode bucket filtering stays in `FilterBar.vue`; this component is
 * browse-only and is not rendered when comparing.
 *
 * Multi-select semantics:
 *   - $type facet: OR within (a token matches if its type is in the set).
 *   - alias / issues facets: AND across facets, OR within. Empty sets = pass.
 *
 * Chip order is stable: known renderer types alphabetically (with `other`
 * last within the type group), then a divider, then `alias` and `issues`.
 */

import { computed } from 'vue'
import { useGallery } from '@/composables/useGallery'
import { OTHER_TYPE } from '@/composables/useFilters'
import type { FacetId } from '@/composables/useFilters'

const { filters, filterCounts } = useGallery()

/** Friendly chip labels for known renderer types. */
const TYPE_LABELS: Record<string, string> = {
  color: 'color',
  dimension: 'dimension',
  typography: 'typography',
  shadow: 'shadow',
  border: 'border',
  gradient: 'gradient',
  [OTHER_TYPE]: 'other',
}

interface ChipOption {
  /** Stable key for the chip. */
  key: string
  /** Toggle target: a type string for $type chips, or a FacetId. */
  value: string
  label: string
  count: number
  active: boolean
}

/**
 * Build the chip list from the live population counts. Types with zero count
 * (not present in the browse set) are omitted. `other` is always last in the
 * type group; `alias` and `issues` follow after a divider.
 */
const chips = computed<{ typeChips: ChipOption[]; facetChips: ChipOption[] }>(() => {
  const counts = filterCounts.value
  const types = filters.activeTypes.value
  const facets = filters.activeFacets.value

  const typeChips: ChipOption[] = []
  for (const [type, count] of Object.entries(counts.types)) {
    if (count === 0) continue
    typeChips.push({
      key: `type-${type}`,
      value: type,
      label: TYPE_LABELS[type] ?? type,
      count,
      active: types.has(type),
    })
  }
  // Known renderer types alphabetically, then OTHER_TYPE last.
  typeChips.sort((a, b) => {
    if (a.value === OTHER_TYPE && b.value !== OTHER_TYPE) return 1
    if (b.value === OTHER_TYPE && a.value !== OTHER_TYPE) return -1
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0
  })

  const facetChips: ChipOption[] = []
  if (counts.alias > 0) {
    facetChips.push({
      key: 'facet-alias',
      value: 'alias',
      label: 'has alias',
      count: counts.alias,
      active: facets.has('alias'),
    })
  }
  if (counts.issues > 0) {
    facetChips.push({
      key: 'facet-issues',
      value: 'issues',
      label: 'has issues',
      count: counts.issues,
      active: facets.has('issues'),
    })
  }

  return { typeChips, facetChips }
})

/** A $type chip was clicked. */
function toggleType(value: string): void {
  filters.toggleType(value)
}

/** A facet chip was clicked. */
function toggleFacet(value: string): void {
  // Cast through string because template bindings are untyped; the only valid
  // values here are 'alias' and 'issues' (the chips we render).
  filters.toggleFacet(value as FacetId)
}
</script>

<template>
  <div
    v-if="chips.typeChips.length > 0 || chips.facetChips.length > 0"
    class="dtv-filterchips"
    role="group"
    aria-label="Filter browse-set tokens"
  >
    <button
      v-for="chip in chips.typeChips"
      :key="chip.key"
      type="button"
      class="dtv-filterchips__chip"
      :class="{ 'dtv-filterchips__chip--active': chip.active }"
      :aria-pressed="chip.active"
      @click="toggleType(chip.value)"
    >
      <span class="dtv-filterchips__label">{{ chip.label }}</span>
      <span class="dtv-filterchips__count">{{ chip.count }}</span>
    </button>

    <span
      v-if="chips.typeChips.length > 0 && chips.facetChips.length > 0"
      class="dtv-filterchips__divider"
      aria-hidden="true"
    ></span>

    <button
      v-for="chip in chips.facetChips"
      :key="chip.key"
      type="button"
      class="dtv-filterchips__chip"
      :class="{ 'dtv-filterchips__chip--active': chip.active }"
      :aria-pressed="chip.active"
      @click="toggleFacet(chip.value)"
    >
      <span class="dtv-filterchips__label">{{ chip.label }}</span>
      <span class="dtv-filterchips__count">{{ chip.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.dtv-filterchips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  align-items: center;
}

.dtv-filterchips__chip {
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

.dtv-filterchips__chip:hover {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-filterchips__chip--active {
  color: #ffffff;
  background-color: var(--dtv-color-text);
  border-color: transparent;
}

.dtv-filterchips__count {
  padding: 0 var(--dtv-spacing-xs);
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: var(--dtv-radius-sm);
  font-variant-numeric: tabular-nums;
  font-size: var(--dtv-font-size-sm);
}

.dtv-filterchips__chip:not(.dtv-filterchips__chip--active) .dtv-filterchips__count {
  background-color: var(--dtv-color-surface-muted);
  color: var(--dtv-color-text-subtle);
}

.dtv-filterchips__divider {
  display: inline-block;
  width: 1px;
  height: 1.5em;
  background-color: var(--dtv-color-border);
  margin: 0 var(--dtv-spacing-xs);
}
</style>
