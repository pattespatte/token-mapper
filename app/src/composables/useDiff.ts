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
 *     Gallery renders in compare mode, honouring `activeFilter` AND the
 *     shared search query.
 *   - `counts` — ComputedRef<Record<DiffBucket, number>>. For the FilterBar
 *     badges.
 *
 * Search is the only filter that applies in compare mode (per the PRD:
 * browse-mode filter chips are browse-only; compare mode keeps its bucket
 * FilterBar). A TokenDiff matches the query when EITHER side matches —
 * designers search by either the value they had (A) or the value they're
 * moving to (B).
 *
 * Module-scoped filter state so it survives set reloads within a session.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { diff as diffFn } from '@dtcg-mapper/core'
import { explainDiff } from '@dtcg-mapper/core'
import { useTokenSets } from './useTokenSets'
import { useSearch } from './useSearch'
import type { DiffBucket, DiffResult, TokenDiff } from '@dtcg-mapper/core'

/** Module-scoped: the active filter survives set reloads within a session. */
const activeFilter: Ref<'all' | DiffBucket> = ref('all')

export function useDiff() {
  const { setA, setB, isComparing } = useTokenSets()
  const search = useSearch()

  /**
   * Raw engine output — deep-equality classification into 4 buckets. This
   * stays single-responsibility; the public `diff` below enriches it with
   * per-token `explanation` for `changed` entries.
   */
  const rawDiff: ComputedRef<DiffResult | null> = computed(() => {
    if (!isComparing.value) return null
    if (setA.value === null || setB.value === null) return null
    return diffFn(setA.value.resolved, setB.value.resolved)
  })

  /**
   * Enriched diff — same shape as `rawDiff` but with `explanation` attached
   * to every `changed` entry. Both sides are guaranteed present for `changed`
   * tokens (the engine's contract), so the explainer always gets a valid pair.
   *
   * Recomputes only when rawDiff invalidates (set reload), not on every
   * keystroke — fine for typical set sizes. The explainer is pure and never
   * throws, so this derivation can't break the rest of the diff UI.
   */
  const diff: ComputedRef<DiffResult | null> = computed(() => {
    const raw = rawDiff.value
    if (raw === null) return null
    return {
      matching: raw.matching,
      // Attach explanation to each changed token. New array — engine output
      // is structurally shared for the unchanged buckets.
      changed: raw.changed.map((td) =>
        td.a !== undefined && td.b !== undefined
          ? { ...td, explanation: explainDiff(td.a, td.b) }
          : td
      ),
      missing: raw.missing,
      extra: raw.extra,
    }
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
   * Flat list of TokenDiffs for the Gallery, honouring the active bucket
   * filter AND the shared search query. Bucket filter applies first (it
   * selects which DiffCards are even shown), then search narrows within.
   *
   * A TokenDiff matches the query when EITHER side matches — designers
   * search by either the value they had (A) or the value they're moving
   * to (B). For `missing` (only A present) and `extra` (only B present),
   * the present side carries the search.
   */
  const filteredDiff: ComputedRef<TokenDiff[]> = computed(() => {
    const d = diff.value
    if (d === null) return []
    const matchesQuery = search.matchPredicate.value
    const bucketList: TokenDiff[] =
      activeFilter.value === 'all'
        ? [...d.matching, ...d.changed, ...d.missing, ...d.extra]
        : d[activeFilter.value]
    return bucketList.filter((td) => {
      if (td.a !== undefined && matchesQuery(td.a)) return true
      if (td.b !== undefined && matchesQuery(td.b)) return true
      return false
    })
  })

  return {
    diff,
    activeFilter,
    filteredDiff,
    counts,
    // Exposed so Gallery / SearchBar share the singleton query state.
    search,
  }
}
