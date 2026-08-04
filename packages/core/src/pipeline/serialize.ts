/**
 * serialize — pure function that rebuilds a W3C DTCG token tree from the flat
 * {@link TokenMap} the pipeline uses internally, and returns it as a JSON
 * string.
 *
 * The inverse of `parseFiles`: parse flattens a DTCG file into a `Map` keyed by
 * dotted path; serialize nests that map back into `{ group: { token: { $value,
 * $type, $description } } }`. This makes it possible to download any loaded set
 * as one valid DTCG JSON file — including sets that were uploaded as CSS, in
 * which case the download doubles as a **CSS → design tokens converter** (the
 * CSS importer already produced `NormalizedToken`s with inferred `$type` and
 * rewritten `{...}` references, so the serialized output is spec-shaped).
 *
 * Purity contract: no Vue, no browser APIs, no I/O. Same constraints as the
 * rest of `pipeline/`. Deterministic: group children are sorted alphabetically
 * at every depth so identical token sets always produce byte-identical output
 * regardless of insertion order.
 */

import type {
  NormalizedToken,
  RawValue,
  ResolvedToken,
} from '../types/token'

/**
 * Which value to emit for each token.
 *
 * - `'raw'` (default) — the unresolved `$value`, keeping `{...}` references
 *   intact. Best for merging files and for a faithful CSS→tokens conversion.
 * - `'resolved'` — the walked literal at the end of the reference chain
 *   (requires a {@link ResolvedTokenMap}). Aliases are replaced by their
 *   terminal values; the alias graph is flattened away.
 */
export type SerializeValue = 'raw' | 'resolved'

/** Options for {@link serializeTokens}. */
export interface SerializeOptions {
  /**
   * Which value to emit. Defaults to `'raw'`. When `'resolved'`, the input map
   * must contain {@link ResolvedToken}s (i.e. `TokenSet.resolved`); passing a
   * raw `TokenMap` with `'resolved'` falls back to `rawValue` per token.
   */
  value?: SerializeValue
}

/**
 * A mutable DTCG node used while building the tree. Either an inner group
 * (children indexed by segment) or a leaf token (carries the `$`-prefixed
 * fields). The two are distinguished at leaf-placement time, not at runtime.
 */
type BuildNode = {
  [key: string]: BuildNode | unknown
}

/**
 * Serialize a token map into a pretty-printed W3C DTCG JSON string.
 *
 * Builds a nested object tree by walking each token's `segments` (the
 * pre-split path), placing `{ $value, $type?, $description? }` at each leaf.
 * `undefined` optional fields are omitted (only `$value` is required by the
 * spec). `originalCssValue` (CSS-renderer metadata) is never emitted — the
 * structured `rawValue` is already the correct DTCG shape.
 *
 * Output is deterministic: at every depth, group children are sorted
 * alphabetically by key. Token-internal `$`-keys (`$value`, `$type`,
 * `$description`) keep their fixed relative order (insertion order), matching
 * the spec's conventional layout.
 *
 * @example
 *   const json = serializeTokens(set.tokens)                    // raw
 *   const json = serializeTokens(set.resolved, { value: 'resolved' })
 *
 * @param tokens  The flat token map (either `set.tokens` or `set.resolved`).
 * @param options {@link SerializeOptions}. `value` defaults to `'raw'`.
 * @returns Pretty-printed JSON (2-space indent) with a trailing newline.
 *          An empty map yields `"{}\n"`.
 */
export function serializeTokens(
  tokens: Map<string, NormalizedToken | ResolvedToken>,
  options?: SerializeOptions
): string {
  const useResolved = options?.value === 'resolved'
  const root: BuildNode = {}

  for (const token of tokens.values()) {
    const value = pickValue(token, useResolved)
    placeLeaf(root, token.segments, {
      $value: value,
      ...(token.type !== undefined ? { $type: token.type } : {}),
      ...(token.description !== undefined
        ? { $description: token.description }
        : {}),
    })
  }

  // Deterministic output: sort group children alphabetically at every depth.
  // Token leaves keep their own key order (insertion order of $value/$type/...).
  const sorted = sortTree(root)
  return JSON.stringify(sorted, null, 2) + '\n'
}

/**
 * Pick the value to emit for a token. Resolved mode prefers `resolvedValue`
 * (only present on `ResolvedToken`); if absent it falls back to `rawValue`,
 * so callers can safely pass either map flavour with either option.
 */
function pickValue(
  token: NormalizedToken | ResolvedToken,
  useResolved: boolean
): RawValue {
  if (useResolved) {
    const resolved = (token as ResolvedToken).resolvedValue
    if (resolved !== undefined) return resolved
  }
  return token.rawValue
}

/**
 * Walk `segments` from the root, creating intermediate group nodes as needed,
 * and place `leaf` at the final segment.
 *
 * If the final segment already holds a group node (a structurally invalid
 * input where a path is both a token and a group — the validator would have
 * flagged this), the token wins and overwrites the group. Downloading an
 * already-loaded set is best-effort; we never throw.
 *
 * `segments` is guaranteed non-empty by the parser (every token has at least
 * one path segment). The `noUncheckedIndexedAccess` guard below is defensive.
 */
function placeLeaf(
  root: BuildNode,
  segments: readonly string[],
  leaf: { $value: RawValue; $type?: unknown; $description?: unknown }
): void {
  if (segments.length === 0) return
  let node = root
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (seg === undefined) return // defensive — parser never produces gaps
    const next = node[seg]
    // Reuse an existing group, or promote/create one. If a previous token
    // lived at this segment (invalid input), overwrite it with a group so the
    // deeper path can still be expressed.
    node[seg] =
      typeof next === 'object' && next !== null && !Array.isArray(next)
        ? (next as BuildNode)
        : {}
    node = node[seg] as BuildNode
  }
  const last = segments[segments.length - 1]
  if (last === undefined) return
  // Token overwrites whatever was at the leaf (group or primitive).
  node[last] = leaf
}

/**
 * Return a new tree with group children sorted alphabetically by key at every
 * depth. Token leaves are returned as-is (their `$`-keys keep insertion order;
 * `JSON.stringify` serialises object keys in insertion order).
 *
 * Plain arrays and non-plain objects inside `$value` (e.g. composite token
 * values) are preserved verbatim — their key order is the token author's, not
 * ours to reorder.
 */
function sortTree(node: BuildNode): BuildNode {
  const sorted: BuildNode = {}
  for (const key of Object.keys(node).sort()) {
    const child = node[key]
    sorted[key] = isBuildNode(child) ? sortTree(child) : child
  }
  return sorted
}

/**
 * Narrow a value to a mutable build-node (a plain non-array object). Used by
 * {@link sortTree} to recurse only into group children, leaving token leaves
 * and composite `$value` objects untouched.
 */
function isBuildNode(value: unknown): value is BuildNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, '$value')
  )
}
