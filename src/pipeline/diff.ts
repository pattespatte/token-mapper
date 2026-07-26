/**
 * Diff engine — classify token differences between two resolved sets.
 *
 * Input:  two ResolvedTokenMaps (set A and set B).
 * Output: a DiffResult partitioning every path in the union of both maps into
 * one of four buckets:
 *
 *   - matching — path exists in both, resolved values are deeply equal.
 *   - changed  — path exists in both, resolved values differ.
 *   - missing  — path exists in A only (missing from B).
 *   - extra    — path exists in B only (extra in B).
 *
 * Bucket labels are written from set A's perspective, matching the
 * documented framing where A is "our system" and B is the external/base file.
 *
 * Comparison is by **resolved value**, not raw value — an alias in A and its
 * literal in B are considered equal. Deep equality handles composite values
 * (typography objects must match field-by-field). Tokens with errored
 * resolution (dangling/cyclic) participate using their raw resolved form
 * (which is the raw reference string) so a broken alias in A and the same
 * broken alias in B are still "matching."
 *
 * This module is pure: no Vue, no I/O, no side effects. That keeps it trivial
 * to unit-test and reuse.
 */

import type { DiffBucket, DiffResult } from '@/types/diff'
import type { RawValue, ResolvedTokenMap } from '@/types/token'

/** Diff two resolved token maps. Pure function. */
export function diff(a: ResolvedTokenMap, b: ResolvedTokenMap): DiffResult {
  const result: DiffResult = {
    matching: [],
    changed: [],
    missing: [],
    extra: [],
  }

  // Paths in A only → missing (from B's perspective).
  for (const [path, aToken] of a) {
    if (!b.has(path)) {
      result.missing.push({ path, bucket: 'missing', a: aToken })
    }
  }

  // Paths in B only → extra (in B).
  for (const [path, bToken] of b) {
    if (!a.has(path)) {
      result.extra.push({ path, bucket: 'extra', b: bToken })
    }
  }

  // Paths in both → matching or changed by deep value equality.
  for (const [path, aToken] of a) {
    const bToken = b.get(path)
    if (bToken === undefined) continue // already handled above

    const bucket: DiffBucket = deepEqual(aToken.resolvedValue, bToken.resolvedValue)
      ? 'matching'
      : 'changed'
    result[bucket].push({ path, bucket, a: aToken, b: bToken })
  }

  // Stable output: sort each bucket by path so the diff is deterministic
  // regardless of map insertion order. Crucial for snapshot tests and for
  // not making the UI jump around on reload.
  for (const bucket of Object.keys(result) as DiffBucket[]) {
    result[bucket].sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0))
  }

  return result
}

/**
 * Deep structural equality for RawValues.
 *
 * Handles the four RawValue kinds:
 *   - primitives (string/number/boolean) — strict equality.
 *   - null — strict equality (null only equals null).
 *   - arrays — same length, elements deeply equal in order.
 *   - objects — same keys, values deeply equal. Key order doesn't matter.
 *
 * Notes:
 *   - `undefined` is treated as distinct from missing (object fields that are
 *     explicitly undefined compare unequal to absent fields). This is rarely
 *     encountered in practice — JSON has no undefined — but the behavior is
 *     well-defined.
 *   - We deliberately do not normalise types (`'42'` vs `42` are NOT equal).
 *     A token whose value is the string "42" and one whose value is the
 *     number 42 are different tokens.
 */
function deepEqual(x: RawValue, y: RawValue): boolean {
  // Same primitive (or both null) — strict equality.
  if (x === y) return true

  // If one is null (and we already know x !== y), they can't be equal.
  if (x === null || y === null) return false

  // Both must be the same composite kind to be equal.
  if (Array.isArray(x)) {
    if (!Array.isArray(y)) return false
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) {
      if (!deepEqual(x[i] as RawValue, y[i] as RawValue)) return false
    }
    return true
  }

  if (typeof x === 'object') {
    if (typeof y !== 'object' || Array.isArray(y)) return false
    const xKeys = Object.keys(x)
    const yKeys = Object.keys(y)
    if (xKeys.length !== yKeys.length) return false
    for (const key of xKeys) {
      if (!Object.prototype.hasOwnProperty.call(y, key)) return false
      if (!deepEqual((x as Record<string, RawValue>)[key] as RawValue, (y as Record<string, RawValue>)[key] as RawValue)) {
        return false
      }
    }
    return true
  }

  // Different primitive types (e.g. string vs number) — already failed the
  // strict-equality check at the top.
  return false
}
