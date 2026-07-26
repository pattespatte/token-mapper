/**
 * useDiff — derive a comparison result from the two loaded sets.
 *
 * Depends on `useTokenSets`. Exposes:
 *   - `diff` — ComputedRef<DiffResult | null>. Null when not comparing; the
 *     classified diff otherwise. Recomputes automatically when either set
 *     changes.
 *   - `activeFilter` — Ref<'all' | DiffBucket>. Bound to the FilterBar in
 *     compare mode.
 *   - `filteredDiff` — ComputedRef<TokenDiff[]>. The single flat list the
 *     Gallery renders in compare mode, honouring `activeFilter`.
 *   - `counts` — ComputedRef<Record<DiffBucket, number>>. For the FilterBar
 *     badges.
 *
 * Module-scoped filter state so it survives set reloads within a session.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { diff as diffFn } from '@/pipeline/diff'
import { useTokenSets } from './useTokenSets'
import type { DiffBucket, DiffResult, TokenDiff } from '@/types/diff'

/** Module-scoped: the active filter survives set reloads within a session. */
const activeFilter: Ref<'all' | DiffBucket> = ref('all')

export function useDiff() {
  const { setA, setB, isComparing } = useTokenSets()

  /** Classified diff, or null when not both sets are loaded. */
  const diff: ComputedRef<DiffResult | null> = computed(() => {
    if (!isComparing.value) return null
    if (setA.value === null || setB.value === null) return null
    return diffFn(setA.value.resolved, setB.value.resolved)
  })

  /** Token counts per bucket, for FilterBar badges. Zero when not comparing. */
  const counts: ComputedRef<Record<DiffBucket, number>> = computed(() => {
    const empty: Record<DiffBucket, number> = {
      matching: 0,
      changed: 0,
      missing: 0,
      extra: 0,
    }
    if (diff.value === null) return empty
    return {
      matching: diff.value.matching.length,
      changed: diff.value.changed.length,
      missing: diff.value.missing.length,
      extra: diff.value.extra.length,
    }
  })

  /**
   * Flat list of TokenDiffs for the Gallery, honouring the active filter.
   * When filter is 'all', concatenates all four buckets (matching first for
   * visual stability — matching is the "everything's fine" baseline).
   */
  const filteredDiff: ComputedRef<TokenDiff[]> = computed(() => {
    const d = diff.value
    if (d === null) return []
    if (activeFilter.value === 'all') {
      return [...d.matching, ...d.changed, ...d.missing, ...d.extra]
    }
    return d[activeFilter.value]
  })

  return {
    diff,
    activeFilter,
    filteredDiff,
    counts,
  }
}
