/**
 * Diff model.
 *
 * The diff engine takes two resolved token maps and classifies every token
 * path (union of both maps' keys) into one of four buckets. Comparison is by
 * *resolved* value — an alias and its literal are considered equal.
 */

import type { ResolvedToken } from './token'

/**
 * The four comparison buckets.
 *
 * - `matching` — same path, same resolved value in A and B.
 * - `changed`  — same path, different resolved value in A and B.
 * - `missing`  — path exists in A but not B (missing from B).
 * - `extra`    — path exists in B but not A (extra in B).
 *
 * Bucket labels are written from set A's perspective ("missing" = missing
 * from B), matching the documented convention where A is "our system" and
 * B is the external/base file.
 */
export type DiffBucket = 'matching' | 'changed' | 'missing' | 'extra'

/**
 * A single token's comparison result. `a` and `b` are present depending on
 * the bucket: both for `matching`/`changed`, only `a` for `missing`, only
 * `b` for `extra`.
 *
 * `explanation` is attached at the composable layer (useDiff) for `changed`
 * tokens — never populated by the diff engine itself, which keeps its
 * single responsibility (deep-equality classification into 4 buckets).
 */
export interface TokenDiff {
  path: string
  bucket: DiffBucket
  /** Resolved token from set A, if present at this path. */
  a?: ResolvedToken
  /** Resolved token from set B, if present at this path. */
  b?: ResolvedToken
  /**
   * Type-aware "changed how?" description. Only present on `changed` tokens
   * (matching/missing/extra have nothing to compare). Attached by useDiff,
   * not the engine.
   */
  explanation?: DiffExplanation
}

/**
 * Full diff result, partitioned by bucket for easy filtering and counting.
 */
export interface DiffResult {
  matching: TokenDiff[]
  changed: TokenDiff[]
  missing: TokenDiff[]
  extra: TokenDiff[]
}

/**
 * Tier 2 presentation layer — a type-aware "changed how?" description for a
 * single `changed` token pair. Produced by the pure `explainDiff` module;
 * consumed by DiffCard (summary only) and DiffInspector (full details list).
 *
 * The diff engine itself is unchanged — this is attached to a `TokenDiff`
 * at the composable layer (`useDiff.ts`).
 */
export interface DiffExplanation {
  /**
   * Short headline for the DiffCard header chip. Compact: ≤ ~12 chars when
   * possible (e.g. `+4px`, `Δ23`, `2 fields`). Shown next to the badge.
   */
  summary: string
  /**
   * Optional field-by-field breakdown for the DiffInspector body. Each entry
   * is one row in the "What changed" list. Omit when a summary-only signal
   * is enough (e.g. dimension's `+4px` carries the whole story).
   */
  details?: { label: string; before: string; after: string }[]
  /**
   * Optional normalised magnitude in [0, 1] for visual weighting. Used by
   * the color explainer (RGB distance / 441 ≈ max). Other types leave it
   * undefined; the UI renders the chip the same either way.
   */
  magnitude?: number
}
