/**
 * Reference resolver — walk `{path.to.token}` aliases to literal values.
 *
 * Input:  a TokenMap of parsed tokens (raw references unresolved).
 * Output: a ResolvedTokenMap where each token carries:
 *   - `resolvedValue` — the terminal literal at the end of the reference chain
 *     (or the raw form if resolution failed).
 *   - `aliasChain` — every hop taken, for display in the inspector.
 *   - `hasError` — true if the chain could not be fully resolved (dangling or
 *     cyclic); the UI still shows the broken alias so the user can see what's
 *     wrong.
 *
 * Composite values (typography, shadow, gradient — `$value` is an object or
 * array) get per-leaf resolution: each `{...}` sub-reference is walked
 * independently while the object/array shape is preserved. This lets a
 * typography token alias some fields (`fontFamily: "{font.sans}"`) and
 * literally set others (`fontSize: "16px"`) in the same value.
 *
 * Cycle safety: the validator already flags cycles, but the resolver never
 * trusts that — it tracks visited paths per chain and bails out as soon as a
 * path repeats, so a missing validation step can't cause an infinite loop.
 */

import type {
  AliasHop,
  NormalizedToken,
  RawValue,
  ResolvedToken,
  ResolvedTokenMap,
  TokenMap,
} from '../types/token'
import { parseReference, findEmbeddedReferences } from '../utils/path'

/** Maximum chain depth before we bail out as a cycle safety net. */
const MAX_DEPTH = 32

/** Resolve every token in the map. Pure function. */
export function resolve(tokens: TokenMap): ResolvedTokenMap {
  const resolved: ResolvedTokenMap = new Map()

  for (const [path, token] of tokens) {
    resolved.set(path, resolveToken(token, tokens))
  }

  return resolved
}

/**
 * Resolve a single token. Delegates to `resolveValue`, then attaches the
 * metadata (chain, hasError) to a shallow-cloned token.
 */
function resolveToken(token: NormalizedToken, tokens: TokenMap): ResolvedToken {
  const { value, chain, hasError } = resolveValue(
    token.rawValue,
    tokens,
    [],
    new Set([token.path])
  )

  return {
    ...token,
    resolvedValue: value,
    aliasChain: chain,
    hasError,
  }
}

/**
 * Recursive core. Walks `value` and resolves every reference inside.
 *
 * @param value       The value (or sub-value) being resolved.
 * @param tokens      The full token map, for following references.
 * @param chain       Accumulated hops so far (only meaningful at the top level
 *                    of a scalar reference; composite values build their own
 *                    per-leaf chains and discard them, since one composite
 *                    value may have many reference chains).
 * @param visited     Paths already on the current chain — used to detect
 *                    cycles. Pre-seeded with the starting token's path.
 */
function resolveValue(
  value: RawValue,
  tokens: TokenMap,
  chain: AliasHop[],
  visited: Set<string>
): { value: RawValue; chain: AliasHop[]; hasError: boolean } {
  // String — could be a whole reference, a partial reference (embedded
  // `{...}` inside larger literal text), or a pure literal.
  if (typeof value === 'string') {
    const refPath = parseReference(value)

    // Not a whole reference. Before declaring it a pure literal, check for
    // embedded `{...}` fragments — a partial reference like
    // `1px solid {color.border}` needs each fragment spliced and a hop
    // recorded per fragment.
    if (refPath === null) {
      return resolvePartialReference(value, tokens, chain, visited)
    }

    // Whole reference — record the hop, then follow it.
    const hop: AliasHop = { path: refPath, raw: value }
    chain.push(hop)

    // Cycle guard.
    if (visited.has(refPath)) {
      hop.resolved = undefined
      return {
        value, // leave the raw `{...}` so the UI shows what broke
        chain,
        hasError: true,
      }
    }

    // Depth guard.
    if (chain.length > MAX_DEPTH) {
      return { value, chain, hasError: true }
    }

    // Dangling reference.
    const target = tokens.get(refPath)
    if (target === undefined) {
      hop.resolved = undefined
      return { value, chain, hasError: true }
    }

    // Recurse into the target's raw value. Track the new path on the visited
    // set so a cycle through it is caught.
    const nextVisited = new Set(visited)
    nextVisited.add(refPath)
    const inner = resolveValue(target.rawValue, tokens, chain, nextVisited)
    hop.resolved = inner.value
    return { value: inner.value, chain, hasError: inner.hasError }
  }

  // Array — resolve each element, preserve shape. Aggregate sub-chains so a
  // composite value's aliasChain reflects every reference it contains (the
  // Inspector relies on this to render "every hop" for typography tokens).
  if (Array.isArray(value)) {
    let hasError = false
    const resolved: RawValue[] = []
    const aggregatedChain: AliasHop[] = [...chain]
    for (const item of value) {
      const r = resolveValue(item, tokens, [], new Set(visited))
      if (r.hasError) hasError = true
      resolved.push(r.value)
      aggregatedChain.push(...r.chain)
    }
    return { value: resolved, chain: aggregatedChain, hasError }
  }

  // Object — resolve each field, preserve shape. Same chain aggregation as
  // the array branch: each sub-reference's hops are collected so the
  // Inspector can show the full picture for composite values.
  if (typeof value === 'object' && value !== null) {
    let hasError = false
    const resolved: Record<string, RawValue> = {}
    const aggregatedChain: AliasHop[] = [...chain]
    for (const [k, v] of Object.entries(value)) {
      const r = resolveValue(v as RawValue, tokens, [], new Set(visited))
      if (r.hasError) hasError = true
      resolved[k] = r.value
      aggregatedChain.push(...r.chain)
    }
    return { value: resolved, chain: aggregatedChain, hasError }
  }

  // Number / boolean / null / undefined — literal.
  return { value, chain, hasError: false }
}

/**
 * Resolve embedded `{...}` fragments inside a string that isn't a whole
 * reference. Splices each target's resolved value into the surrounding literal
 * text to build a new `resolvedValue`, and records one hop per fragment on the
 * chain (annotating).
 *
 * Behaviour:
 *   - No embedded references → pure literal: returned unchanged with no hops
 *     and `hasError: false` (identical to the pre-partial-reference behaviour).
 *   - Each embedded reference is resolved via {@link resolveValue}, sharing the
 *     `visited` set so a cycle through a fragment is caught. Its resolved
 *     value is stringified and spliced into the rebuilt string.
 *   - A dangling or cyclic fragment is left as its raw `{...}` form in the
 *     rebuilt string, its hop's `resolved` is set to `undefined`, and
 *     `hasError` becomes true — the UI shows the broken fragment in context.
 *   - Depth guard: if the chain is already at {@link MAX_DEPTH}, fragments are
 *     left in place and `hasError` is true (mirrors the whole-reference path).
 *
 * @param value    The string to scan for embedded references.
 * @param tokens   The full token map, for following fragment references.
 * @param chain    The accumulated hop chain (mutated: one hop per fragment).
 * @param visited  Paths on the current chain, for cycle detection.
 */
function resolvePartialReference(
  value: string,
  tokens: TokenMap,
  chain: AliasHop[],
  visited: Set<string>
): { value: RawValue; chain: AliasHop[]; hasError: boolean } {
  const refs = findEmbeddedReferences(value)
  // Pure literal — fast path, identical to historic behaviour.
  if (refs.length === 0) {
    return { value, chain, hasError: false }
  }

  // Depth guard — matches the whole-reference behaviour.
  if (chain.length > MAX_DEPTH) {
    return { value, chain, hasError: true }
  }

  let hasError = false
  // Build the resolved string by walking the source left-to-right, copying
  // literal spans verbatim and splicing each reference's resolved value.
  let rebuilt = ''
  let cursor = 0
  for (const ref of refs) {
    // Literal text before this reference.
    rebuilt += value.slice(cursor, ref.start)
    cursor = ref.end

    const hop: AliasHop = { path: ref.path, raw: ref.raw }
    chain.push(hop)

    // Cycle / dangling / missing handling.
    if (visited.has(ref.path)) {
      hop.resolved = undefined
      hasError = true
      rebuilt += ref.raw // leave the fragment so the UI shows what broke
      continue
    }
    const target = tokens.get(ref.path)
    if (target === undefined) {
      hop.resolved = undefined
      hasError = true
      rebuilt += ref.raw
      continue
    }

    // Resolve the fragment's target, tracking the path for cycle safety.
    const nextVisited = new Set(visited)
    nextVisited.add(ref.path)
    const inner = resolveValue(target.rawValue, tokens, chain, nextVisited)
    hop.resolved = inner.value
    if (inner.hasError) {
      hasError = true
      rebuilt += ref.raw // keep the raw fragment on error
    } else {
      // Splice the resolved value (stringified — partial refs are inherently
      // string contexts, e.g. inside a CSS shorthand).
      rebuilt += typeof inner.value === 'string' ? inner.value : JSON.stringify(inner.value)
    }
  }
  // Trailing literal text after the last reference.
  rebuilt += value.slice(cursor)

  return { value: rebuilt, chain, hasError }
}
