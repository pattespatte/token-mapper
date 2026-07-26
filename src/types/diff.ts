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
 */
export interface TokenDiff {
  path: string
  bucket: DiffBucket
  /** Resolved token from set A, if present at this path. */
  a?: ResolvedToken
  /** Resolved token from set B, if present at this path. */
  b?: ResolvedToken
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
