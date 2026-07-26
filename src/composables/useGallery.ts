/**
 * useGallery — UI state for the browse experience (categories + selection).
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
 * The compare-mode state lives in useDiff; this composable is browse-only.
 * Both composables read from useTokenSets via their own calls — they share
 * state through that singleton, not through each other.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useTokenSets } from './useTokenSets'

const activeCategory: Ref<string> = ref('all')
const selectedTokenPath: Ref<string | null> = ref(null)

export function useGallery() {
  const { setA, setB, isComparing } = useTokenSets()

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

  /** Tokens to render in the Gallery, filtered by the active category. */
  const visibleTokens: ComputedRef<{ path: string; segments: string[] }[]> = computed(() => {
    const set = browseSet.value
    if (set === null) return []
    const cat = activeCategory.value
    const out: { path: string; segments: string[] }[] = []
    for (const token of set.tokens.values()) {
      if (cat === 'all' || (token.segments[0] ?? '') === cat) {
        out.push({ path: token.path, segments: token.segments })
      }
    }
    // Sort by path for stable rendering.
    out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    return out
  })

  /** Selected resolved token (for the Inspector). Null when nothing selected. */
  const selectedToken = computed(() => {
    const path = selectedTokenPath.value
    if (path === null) return null
    const set = browseSet.value
    if (set === null) return null
    return set.resolved.get(path) ?? null
  })

  /** Reset the category to 'all' (called when a new set is loaded). */
  function resetCategory(): void {
    activeCategory.value = 'all'
  }

  /** Clear the selection (called when the Inspector closes). */
  function clearSelection(): void {
    selectedTokenPath.value = null
  }

  return {
    activeCategory,
    selectedTokenPath,
    browseSet,
    categories,
    visibleTokens,
    selectedToken,
    resetCategory,
    clearSelection,
  }
}
