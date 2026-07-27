/**
 * useFilters — browse-mode facet filters that compose with search.
 *
 * Two multi-select facets:
 *   - `$type` — toggle chips per type present in the browse set, plus an
 *     `other` chip for any token whose `$type` lacks a dedicated renderer.
 *     Multiple types OR within this facet (a token passes if its type is in
 *     the active set).
 *   - `facets` — `alias` (aliasChain non-empty) and `issues` (the set's
 *     validation list mentions this token's path). Both OR within the facet
 *     but AND with the type facet.
 *
 * Across facets: type AND alias AND issues. Empty sets = no filtering
 * (current behaviour preserved).
 *
 * Module-scoped state survives set reloads within a session (matches
 * `activeCategory` / `activeFilter` / `query`).
 *
 * Counts reflect the **browse set's full population**, NOT the active-filtered
 * view — so chips never vanish as you filter and you can always click your way
 * back out. Decision recorded in the PRD.
 *
 * Browse-mode only. Compare mode keeps its bucket FilterBar; only search
 * applies there.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { ResolvedToken, TokenSet } from '@dtcg-mapper/core'

/** Facet toggle identifiers. `$type` is open-ended so handled separately. */
export type FacetId = 'alias' | 'issues'

/**
 * Sentinel for the "no dedicated renderer" bucket. Tokens whose $type is
 * not in `KNOWN_RENDERER_TYPES` (or has no $type at all) fall in here. This
 * mirrors what the gallery renders via `GenericToken`.
 *
 * Kept as a string (not a special DtcgType) because it's a UI facet label,
 * not a token type.
 */
export const OTHER_TYPE = '__other__'

/**
 * Token types that have a dedicated renderer component. A token whose $type
 * is outside this set (or undefined) is filed under OTHER_TYPE.
 *
 * Phase 3: color, dimension, typography (the three currently-registered
 * renderers). Phase 5 will extend this with 'shadow', 'border', 'gradient'
 * once those renderers ship.
 */
const KNOWN_RENDERER_TYPES = new Set<string>([
  'color',
  'dimension',
  'typography',
])

/**
 * The chip key for a token: its $type if that type has a dedicated renderer,
 * otherwise OTHER_TYPE. Used by both `tokenMatchesFilters` (predicate) and
 * `computeFilterCounts` (chip populations) so the bucket assignment is
 * consistent.
 */
export function typeKeyFor(token: ResolvedToken): string {
  if (token.type !== undefined && KNOWN_RENDERER_TYPES.has(token.type)) {
    return token.type
  }
  return OTHER_TYPE
}

/** Module-scoped singleton: shared across every call of useFilters. */
const activeTypes: Ref<Set<string>> = ref(new Set())
const activeFacets: Ref<Set<FacetId>> = ref(new Set())

/**
 * Does this resolved token have a (non-empty) reference chain?
 */
function tokenHasAlias(token: ResolvedToken): boolean {
  return token.aliasChain.length > 0
}

/**
 * Does the browse set carry any validation issue at this token's path?
 * Per-token issues share the token's dotted path; file-level issues
 * (INVALID_JSON) carry the filename as `path`, which won't match any token
 * path, so they're naturally excluded.
 */
function tokenHasIssues(token: ResolvedToken, set: TokenSet): boolean {
  return set.validation.some((issue) => issue.path === token.path)
}

/**
 * Pure predicate: does the token pass every active filter?
 *
 * Type facet: OR within (any active type matches); empty set = pass.
 * Facets: AND across facets, OR within (an empty facet set = pass).
 */
export function tokenMatchesFilters(
  token: ResolvedToken,
  set: TokenSet,
  types: Set<string>,
  facets: Set<FacetId>
): boolean {
  // $type facet (OR within). Each token has exactly one chip key, so this
  // is a simple membership check.
  if (types.size > 0) {
    if (!types.has(typeKeyFor(token))) return false
  }

  // Facet filters: AND across (every active facet must individually pass).
  if (facets.size > 0) {
    for (const facet of facets) {
      let passes = false
      if (facet === 'alias' && tokenHasAlias(token)) passes = true
      if (facet === 'issues' && tokenHasIssues(token, set)) passes = true
      if (!passes) return false
    }
  }

  return true
}

/**
 * Compute population counts for a specific browse set. Pure helper exported
 * so `useGallery` can wrap it in a reactive computed (where the browse set
 * is naturally in scope) and tests can call it directly with fixtures.
 *
 *   - types: { [dtcgType or OTHER_TYPE]: count }
 *   - alias: number of tokens with non-empty aliasChain
 *   - issues: number of tokens whose path appears in set.validation
 */
export function computeFilterCounts(set: TokenSet | null): {
  types: Record<string, number>
  alias: number
  issues: number
} {
  const types: Record<string, number> = {}
  let alias = 0
  let issues = 0
  if (set === null) return { types, alias, issues }

  const issuePaths = new Set(set.validation.map((i) => i.path))

  for (const token of set.resolved.values()) {
    const key = typeKeyFor(token)
    types[key] = (types[key] ?? 0) + 1
    if (token.aliasChain.length > 0) alias += 1
    if (issuePaths.has(token.path)) issues += 1
  }

  return { types, alias, issues }
}

export function useFilters(): {
  activeTypes: Ref<Set<string>>
  activeFacets: Ref<Set<FacetId>>
  /** Toggle a $type chip on/off. Pass a DtcgType or OTHER_TYPE. */
  toggleType: (type: string) => void
  /** Toggle an `alias` / `issues` facet chip on/off. */
  toggleFacet: (facet: FacetId) => void
  /** Empty both type and facet sets. */
  clearAll: () => void
  /**
   * Predicate bound to the current type/facet state. ANDs type and facets
   * per `tokenMatchesFilters` semantics.
   */
  matchPredicate: ComputedRef<(token: ResolvedToken, set: TokenSet) => boolean>
} {
  function toggleType(type: string): void {
    const next = new Set(activeTypes.value)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    activeTypes.value = next
  }

  function toggleFacet(facet: FacetId): void {
    const next = new Set(activeFacets.value)
    if (next.has(facet)) next.delete(facet)
    else next.add(facet)
    activeFacets.value = next
  }

  function clearAll(): void {
    activeTypes.value = new Set()
    activeFacets.value = new Set()
  }

  const matchPredicate = computed(() => {
    const types = activeTypes.value
    const facets = activeFacets.value
    return (token: ResolvedToken, set: TokenSet) =>
      tokenMatchesFilters(token, set, types, facets)
  })

  return {
    activeTypes,
    activeFacets,
    toggleType,
    toggleFacet,
    clearAll,
    matchPredicate,
  }
}
