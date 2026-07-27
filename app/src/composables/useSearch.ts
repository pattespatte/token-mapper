/**
 * useSearch — global substring search across path / description / value.
 *
 * Module-scoped `query` ref so the search box survives set reloads within a
 * session (matches the `activeCategory` / `activeFilter` patterns elsewhere).
 * Empty or whitespace-only query means "no filtering" — current behaviour
 * preserved.
 *
 * The predicate is pure given a token + the current query value: it can be
 * unit-tested without mounting Vue. `useGallery.visibleTokens` and
 * `useDiff.filteredDiff` AND it together with their other filters.
 *
 * Search is a case-insensitive substring match across the union of three
 * fields:
 *   1. token path (`color.gray.50`)
 *   2. `$description` (if present)
 *   3. resolved value text — for primitives the literal, for composite types
 *      the JSON-serialised form (so `{color.indigo.500}` references are also
 *      searchable once resolved to their literal).
 */

import { ref, computed, type ComputedRef } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

/** Module-scoped singleton: shared across every call of useSearch. */
const query = ref('')

/**
 * JSON stringify that never throws. Mirrors the defensive pattern in
 * Inspector.vue's `rawFormatted` / `resolvedFormatted` computeds — some
 * raw values (e.g. cyclic structures from malformed input) would otherwise
 * crash `JSON.stringify`.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

/**
 * Case-insensitive substring match across the three searchable fields.
 * Whitespace-only needle matches everything (treated as no filter).
 */
export function tokenMatchesQuery(token: ResolvedToken, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (needle === '') return true

  if (token.path.toLowerCase().includes(needle)) return true
  if (token.description !== undefined && token.description.toLowerCase().includes(needle)) {
    return true
  }
  // JSON-serialise resolved value so composite types (typography objects,
  // shadow arrays, etc.) are searchable field-by-field.
  const valueText = safeStringify(token.resolvedValue).toLowerCase()
  if (valueText.includes(needle)) return true

  return false
}

export function useSearch(): {
  query: typeof query
  /** Predicate bound to the current query — pass to filter loops. */
  matchPredicate: ComputedRef<(token: ResolvedToken) => boolean>
  /** Empty the query (called by the ✕ button and Esc). */
  clearInput: () => void
} {
  const matchPredicate = computed(() => {
    const q = query.value
    return (token: ResolvedToken) => tokenMatchesQuery(token, q)
  })

  function clearInput(): void {
    query.value = ''
  }

  return { query, matchPredicate, clearInput }
}
