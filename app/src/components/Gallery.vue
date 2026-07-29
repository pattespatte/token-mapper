<script setup lang="ts">
/**
 * Gallery — the main content area.
 *
 * Two modes:
 *   - Browse (one set loaded): grid of TokenCards for the browse set,
 *     filtered by category AND search AND filter chips. Selection state
 *     stored for the Inspector.
 *   - Compare (both sets loaded): FilterBar + SearchBar + grid of DiffCards
 *     from useDiff.filteredDiff, honouring the active bucket filter AND
 *     search.
 *
 * The `compare` prop is the switch — derived from useTokenSets.isComparing
 * by the parent (App.vue).
 *
 * `/` keyboard shortcut: focuses the search input from anywhere outside a
 * text-editable element. Wired here (document-level listener) rather than in
 * SearchBar so the shortcut works regardless of focus.
 */

import { computed, onMounted, onUnmounted } from 'vue'
import type { ResolvedToken, ValidationIssue } from '@dtcg-mapper/core'
import { useGallery } from '@/composables/useGallery'
import { useDiff } from '@/composables/useDiff'
import { useValidationPanel } from '@/composables/useValidationPanel'
import TokenCard from './TokenCard.vue'
import DiffCard from './DiffCard.vue'
import FilterBar from './FilterBar.vue'
import SearchBar from './SearchBar.vue'
import FilterChips from './FilterChips.vue'
import ExportMenu from './ExportMenu.vue'

const props = defineProps<{
  /** When true, render the compare-mode layout. */
  compare?: boolean
}>()

const {
  browseSet,
  visibleTokens,
  selectedTokenPath,
  selectedDiffPath,
  activeCategory,
} = useGallery()
const { filteredDiff } = useDiff()
const { openForValidation } = useValidationPanel()

/* ------------------------------ Browse mode ------------------------------ */

const browseHeading = computed(() => {
  const cat = activeCategory.value
  if (cat === 'all') return 'All tokens'
  return cat
})

/**
 * Browse set's validation issues grouped by token path, so each card can be
 * stamped with its issues in one lookup instead of re-scanning the whole
 * issues list per card. `undefined` (no entry) means "no issues" — cards
 * default to an empty array via `?? []`. Recomputed when the browse set or
 * its issues change.
 */
const issueMap = computed<Map<string, ValidationIssue[]>>(() => {
  const set = browseSet.value
  if (set === null) return new Map()
  const map = new Map<string, ValidationIssue[]>()
  for (const issue of set.validation) {
    const list = map.get(issue.path)
    if (list === undefined) {
      map.set(issue.path, [issue])
    } else {
      list.push(issue)
    }
  }
  return map
})

/** A browse card: its resolved token plus any validation issues (empty when none). */
interface BrowseCard {
  token: ResolvedToken
  issues: ValidationIssue[]
}

/**
 * Cards to render in browse mode: each visible token paired with its issues
 * (empty when none). Previously this returned bare `ResolvedToken`s, which
 * left no room to surface validation problems on the card — the issue list
 * was discarded along with the set. Threading `issues` through lets TokenCard
 * show the per-card indicator.
 */
const browseCards = computed<BrowseCard[]>(() => {
  const set = browseSet.value
  if (set === null) return []
  const issues = issueMap.value
  const cards: BrowseCard[] = []
  for (const { path } of visibleTokens.value) {
    const token = set.resolved.get(path)
    if (token === undefined) continue
    cards.push({ token, issues: issues.get(path) ?? [] })
  }
  return cards
})

function handleSelect(path: string): void {
  // Toggle off if the same card is clicked again; otherwise select.
  if (selectedTokenPath.value === path) {
    selectedTokenPath.value = null
  } else {
    selectedTokenPath.value = path
  }
}

/**
 * Card issue-indicator click → open the browse set's validation panel and
 * scroll it into view. The set is guaranteed non-null here (cards only render
 * when a set is loaded), but the guard keeps the call honest.
 */
async function handleJumpToValidation(): Promise<void> {
  const set = browseSet.value
  if (set === null) return
  await openForValidation(set.id)
}

/** Compare-mode DiffCard click → toggles the DiffInspector selection. */
function handleDiffSelect(path: string): void {
  if (selectedDiffPath.value === path) {
    selectedDiffPath.value = null
  } else {
    selectedDiffPath.value = path
  }
}

/* ----------------------------- Compare mode ------------------------------ */

const compareHeading = computed(() => {
  // Could reflect the active filter here ("Changed (3)"); keep it simple
  // for v1 — the FilterBar already shows counts prominently.
  return 'Comparison'
})

/* ------------------------- `/` search shortcut --------------------------- */

/** True when the current keyboard focus is in a text-editable element. */
function isFocusInTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/** Document-level `/` handler: focus the search input from anywhere. */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== '/') return
  if (isFocusInTextField(event.target)) return
  // Ignore modifier combos (Cmd+/, Ctrl+/, etc.) — those belong to the
  // browser or the user agent.
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const input = document.querySelector<HTMLInputElement>('#dtm-searchbar-input')
  if (input === null) return
  event.preventDefault()
  input.focus()
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div class="dtm-gallery">
    <!-- Shared search bar (both modes). FilterChips is browse-only. -->
    <div class="dtm-gallery__search-row">
      <SearchBar />
      <FilterChips v-if="!compare" />
    </div>

    <!-- BROWSE MODE -->
    <div v-if="!compare" class="dtm-gallery__browse">
      <h1 class="dtm-gallery__heading">{{ browseHeading }}</h1>

      <p
        v-if="browseSet === null"
        class="dtm-gallery__empty"
      >
        No tokens loaded. Click <strong>Load demo</strong> above, or drop a
        W3C DTCG JSON file into either slot.
      </p>

      <p
        v-else-if="browseCards.length === 0"
        class="dtm-gallery__empty"
      >
        No tokens match the current filters.
      </p>

      <div v-else class="dtm-gallery__grid">
        <TokenCard
          v-for="{ token, issues } in browseCards"
          :key="token.path"
          :token="token"
          :issues="issues"
          :class="{ 'dtm-token-card--selected': selectedTokenPath === token.path }"
          @select="handleSelect"
          @jump-to-validation="handleJumpToValidation"
        />
      </div>
    </div>

    <!-- COMPARE MODE -->
    <div v-else class="dtm-gallery__compare">
      <div class="dtm-gallery__compare-header">
        <h1 class="dtm-gallery__heading">{{ compareHeading }}</h1>
        <FilterBar />
        <ExportMenu />
      </div>

      <p
        v-if="filteredDiff.length === 0"
        class="dtm-gallery__empty"
      >
        No tokens in the current filter.
      </p>

      <div v-else class="dtm-gallery__grid dtm-gallery__grid--compare">
        <DiffCard
          v-for="d in filteredDiff"
          :key="`${d.bucket}-${d.path}`"
          :diff="d"
          :class="{ 'dtm-diffcard--selected': selectedDiffPath === d.path }"
          @select="handleDiffSelect"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dtm-gallery {
  padding: var(--dtm-spacing-lg);
}

.dtm-gallery__search-row {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
  margin-bottom: var(--dtm-spacing-md);
}

.dtm-gallery__heading {
  margin: 0;
  font-size: var(--dtm-font-size-xl);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text);
}

.dtm-gallery__compare-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--dtm-spacing-md);
  margin-bottom: var(--dtm-spacing-md);
}

.dtm-gallery__empty {
  margin: 0;
  padding: var(--dtm-spacing-lg);
  text-align: center;
  color: var(--dtm-color-text-subtle);
  background-color: var(--dtm-color-surface);
  border: 1px dashed var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
}

.dtm-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--dtm-spacing-md);
}

/* Compare cards are wider — they hold two side-by-side visuals. */
.dtm-gallery__grid--compare {
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
}

/* Selected-card affordance in browse mode. */
.dtm-gallery__grid :deep(.dtm-token-card--selected) {
  border-color: var(--dtm-color-accent);
  box-shadow: 0 0 0 2px var(--dtm-color-accent);
}
</style>
