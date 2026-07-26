/**
 * useGallery — UI state for the browse experience (categories + selection +
 * search + filters).
 *
 * Owns:
 *   - `activeCategory` — which top-level path segment is selected in the
 *     Sidebar ('all' or e.g. 'color', 'spacing', 'typography'). Survives set
 *     reloads within a session so the user doesn't snap back to "all" on
 *     every upload.
 *   - `selectedTokenPath` — the token path the Inspector is showing (null when
 *     closed). Clicking a TokenCard sets this; closing the Inspector clears it.
 *   - `browseSetId` — when not comparing (only one set loaded), which set is
 *     the gallery browsing. Defaults to A; flips to B if only B is loaded.
 *
 * Composes (delegates to) two sibling composables for the search box and the
 * browse-mode facet chips:
 *   - `useSearch`  — substring match across path / description / value.
 *   - `useFilters` — $type + alias + issues facet filters.
 *
 * `visibleTokens` ANDs category + search + filters together. Counts (for the
 * FilterChips labels) are computed from the **full browse-set population** so
 * chips stay stable while the user toggles them.
 *
 * The compare-mode state lives in useDiff; this composable is browse-only.
 * Both composables read from useTokenSets via their own calls — they share
 * state through that singleton, not through each other.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useTokenSets } from './useTokenSets'
import { useSearch } from './useSearch'
import { useFilters, computeFilterCounts } from './useFilters'
import { useDiff } from './useDiff'
import type { TokenDiff } from '@/types/diff'

const activeCategory: Ref<string> = ref('all')
const selectedTokenPath: Ref<string | null> = ref(null)
/**
 * Parallel to `selectedTokenPath` for compare mode: the path the DiffInspector
 * is currently showing. Kept separate so browse-mode selection logic stays
 * untouched (PRD decision #1). At most one of the two is non-null at a time
 * because browse and compare are mutually exclusive UI modes.
 */
const selectedDiffPath: Ref<string | null> = ref(null)

export function useGallery() {
  const { setA, setB, isComparing } = useTokenSets()
  const { diff } = useDiff()
  const search = useSearch()
  const filters = useFilters()

  /**
   * The set currently being browsed when not comparing. Falls back to A,
   * then B, whichever has data. Null when nothing is loaded.
   */
  const browseSet: ComputedRef<ReturnType<typeof useTokenSets>['setA']['value']> = computed(() => {
    if (isComparing.value) return null
    return setA.value ?? setB.value
  })

  /**
   * Category list derived from the browse set's tokens. Always includes 'all'
   * first. Empty when no set is loaded.
   */
  const categories: ComputedRef<{ name: string; count: number }[]> = computed(() => {
    const set = browseSet.value
    if (set === null) return []
    const counts = new Map<string, number>()
    for (const token of set.tokens.values()) {
      const cat = token.segments[0] ?? '(root)'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    // Sort alphabetically for stable Sidebar order; 'all' is prepended below.
    return [
      { name: 'all', count: set.tokens.size },
      ...[...counts.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, count]) => ({ name, count })),
    ]
  })

  /**
   * Tokens to render in the Gallery, filtered by category AND search AND
   * facet filters. Returns the existing `{ path, segments }` shape so the
   * downstream `browseCards` mapping (path → resolved token) is unchanged.
   *
   * Search and facet predicates operate on ResolvedToken (so they see
   * aliasChain and resolvedValue), so we look each token up in the resolved
   * map first; tokens whose path isn't in the resolved map (shouldn't happen
   * but is defensive) are dropped.
   */
  const visibleTokens: ComputedRef<{ path: string; segments: string[] }[]> = computed(() => {
    const set = browseSet.value
    if (set === null) return []
    const cat = activeCategory.value
    const matchesQuery = search.matchPredicate.value
    const matchesFilters = filters.matchPredicate.value
    const out: { path: string; segments: string[] }[] = []
    for (const token of set.tokens.values()) {
      if (cat !== 'all' && (token.segments[0] ?? '') !== cat) continue
      const resolved = set.resolved.get(token.path)
      if (resolved === undefined) continue
      if (!matchesQuery(resolved)) continue
      if (!matchesFilters(resolved, set)) continue
      out.push({ path: token.path, segments: token.segments })
    }
    // Sort by path for stable rendering.
    out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    return out
  })

  /**
   * Population counts for the FilterChips labels. Reflects the FULL browse
   * set, not the filtered view (decision #4 in the PRD) — otherwise chips
   * vanish as you filter and you can't click your way back out.
   */
  const filterCounts = computed(() => computeFilterCounts(browseSet.value))

  /** Selected resolved token (for the Inspector). Null when nothing selected. */
  const selectedToken = computed(() => {
    const path = selectedTokenPath.value
    if (path === null) return null
    const set = browseSet.value
    if (set === null) return null
    return set.resolved.get(path) ?? null
  })

  /**
   * The TokenDiff currently shown in the DiffInspector. Searched across all
   * four buckets of the live diff. Null when no diff is selected, when
   * nothing is loaded, or when the path isn't in the current diff (which can
   * happen briefly after a set reload).
   */
  const selectedDiff = computed<TokenDiff | null>(() => {
    const path = selectedDiffPath.value
    if (path === null) return null
    const d = diff.value
    if (d === null) return null
    return (
      d.matching.find((t) => t.path === path) ??
      d.changed.find((t) => t.path === path) ??
      d.missing.find((t) => t.path === path) ??
      d.extra.find((t) => t.path === path) ??
      null
    )
  })

  /** Reset the category to 'all' (called when a new set is loaded). */
  function resetCategory(): void {
    activeCategory.value = 'all'
  }

  /** Clear the selection (called when the Inspector closes). */
  function clearSelection(): void {
    selectedTokenPath.value = null
  }

  /** Clear the compare-mode selection (called when DiffInspector closes). */
  function clearDiffSelection(): void {
    selectedDiffPath.value = null
  }

  return {
    activeCategory,
    selectedTokenPath,
    selectedDiffPath,
    browseSet,
    categories,
    visibleTokens,
    selectedToken,
    selectedDiff,
    resetCategory,
    clearSelection,
    clearDiffSelection,
    // Search + filters exposed so SearchBar / FilterChips share the same
    // singleton state as useGallery's visibleTokens computation.
    search,
    filters,
    filterCounts,
  }
}
