<script setup lang="ts">
/**
 * Gallery — the main content area.
 *
 * Two modes:
 *   - Browse (one set loaded): grid of TokenCards for the browse set,
 *     filtered by the active category. Selection state stored for the
 *     Phase 12 Inspector.
 *   - Compare (both sets loaded): FilterBar + grid of DiffCards from
 *     useDiff.filteredDiff, honouring the active bucket filter.
 *
 * The `compare` prop is the switch — derived from useTokenSets.isComparing
 * by the parent (App.vue).
 */

import { computed } from 'vue'
import { useGallery } from '@/composables/useGallery'
import { useDiff } from '@/composables/useDiff'
import TokenCard from './TokenCard.vue'
import DiffCard from './DiffCard.vue'
import FilterBar from './FilterBar.vue'

const props = defineProps<{
  /** When true, render the compare-mode layout. */
  compare?: boolean
}>()

const {
  browseSet,
  visibleTokens,
  selectedTokenPath,
  activeCategory,
} = useGallery()
const { filteredDiff } = useDiff()

/* ------------------------------ Browse mode ------------------------------ */

const browseHeading = computed(() => {
  const cat = activeCategory.value
  if (cat === 'all') return 'All tokens'
  return cat
})

const browseCards = computed(() => {
  const set = browseSet.value
  if (set === null) return []
  return visibleTokens.value
    .map(({ path }) => set.resolved.get(path))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
})

function handleSelect(path: string): void {
  // Toggle off if the same card is clicked again; otherwise select.
  if (selectedTokenPath.value === path) {
    selectedTokenPath.value = null
  } else {
    selectedTokenPath.value = path
  }
}

/* ----------------------------- Compare mode ------------------------------ */

const compareHeading = computed(() => {
  // Could reflect the active filter here ("Changed (3)"); keep it simple
  // for v1 — the FilterBar already shows counts prominently.
  return 'Comparison'
})
</script>

<template>
  <div class="dtv-gallery">
    <!-- BROWSE MODE -->
    <div v-if="!compare" class="dtv-gallery__browse">
      <h1 class="dtv-gallery__heading">{{ browseHeading }}</h1>

      <p
        v-if="browseSet === null"
        class="dtv-gallery__empty"
      >
        No tokens loaded. Click <strong>Load demo</strong> above, or drop a
        W3C DTCG JSON file into either slot.
      </p>

      <p
        v-else-if="browseCards.length === 0"
        class="dtv-gallery__empty"
      >
        No tokens in this category.
      </p>

      <div v-else class="dtv-gallery__grid">
        <TokenCard
          v-for="token in browseCards"
          :key="token.path"
          :token="token"
          :class="{ 'dtv-token-card--selected': selectedTokenPath === token.path }"
          @select="handleSelect"
        />
      </div>
    </div>

    <!-- COMPARE MODE -->
    <div v-else class="dtv-gallery__compare">
      <div class="dtv-gallery__compare-header">
        <h1 class="dtv-gallery__heading">{{ compareHeading }}</h1>
        <FilterBar />
      </div>

      <p
        v-if="filteredDiff.length === 0"
        class="dtv-gallery__empty"
      >
        No tokens in the current filter.
      </p>

      <div v-else class="dtv-gallery__grid dtv-gallery__grid--compare">
        <DiffCard
          v-for="d in filteredDiff"
          :key="`${d.bucket}-${d.path}`"
          :diff="d"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dtv-gallery {
  padding: var(--dtv-spacing-lg);
}

.dtv-gallery__heading {
  margin: 0;
  font-size: var(--dtv-font-size-xl);
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text);
}

.dtv-gallery__compare-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--dtv-spacing-md);
  margin-bottom: var(--dtv-spacing-md);
}

.dtv-gallery__empty {
  margin: 0;
  padding: var(--dtv-spacing-lg);
  text-align: center;
  color: var(--dtv-color-text-subtle);
  background-color: var(--dtv-color-surface);
  border: 1px dashed var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
}

.dtv-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--dtv-spacing-md);
}

/* Compare cards are wider — they hold two side-by-side visuals. */
.dtv-gallery__grid--compare {
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
}

/* Selected-card affordance in browse mode. */
.dtv-gallery__grid :deep(.dtv-token-card--selected) {
  border-color: var(--dtv-color-accent);
  box-shadow: 0 0 0 2px var(--dtv-color-accent);
}
</style>
