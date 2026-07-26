/**
 * Validator — check a parsed token map against the W3C DTCG spec.
 *
 * Emits a list of issues per token. Issues are surfaced in a panel after the
 * visual gallery (per the PRD). Severity:
 *   - `error`   — token is unusable (dangling reference, cyclic reference).
 *   - `warning` — token is usable but suspicious (missing $type, unknown
 *     $type, value shape doesn't match $type).
 *
 * The validator never throws. Bad data produces issues; the rest of the
 * pipeline still runs. This makes the tool forgiving for partial/garbage
 * uploads — a designer pointing it at the wrong file sees a helpful list of
 * problems rather than a blank screen.
 *
 * Reference syntax (`{path.to.token}`) is recognised via `parseReference`.
 * Dangling and cyclic references are detected here; resolution itself happens
 * in the resolver (Phase 5).
 */

import type { DtcgType } from '@/types/dtcg'
import type { NormalizedToken, RawValue, TokenMap } from '@/types/token'
import type { ValidationIssue } from '@/types/validation'
import { parseReference } from '@/utils/path'

/** Maximum reference-chain depth before we declare a cycle. */
const MAX_REFERENCE_DEPTH = 32

/** W3C-defined $type values we have dedicated validators for. */
const KNOWN_TYPES = new Set<DtcgType>([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'number',
  'cubicBezier',
  'typography',
  'border',
  'transition',
  'shadow',
  'gradient',
  'strokeStyle',
])

/**
 * Validate a token map. Returns a list of issues; empty list means clean.
 *
 * Order of checks per token:
 *   1. $type presence and recognition.
 *   2. value-shape match against $type (warning if mismatched).
 *   3. reference targets exist (dangling → error).
 *   4. reference chains terminate (cyclic → error).
 */
export function validate(tokens: TokenMap): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const token of tokens.values()) {
    // 1. $type presence
    if (token.type === undefined) {
      issues.push({
        path: token.path,
        severity: 'warning',
        code: 'MISSING_TYPE',
        message: `Token "${token.path}" has no $type — value cannot be validated or rendered specifically.`,
      })
      // Without a type we can't do shape checks; references still get checked.
    } else if (!KNOWN_TYPES.has(token.type)) {
      issues.push({
        path: token.path,
        severity: 'warning',
        code: 'UNKNOWN_TYPE',
        message: `Token "${token.path}" has unknown $type "${token.type}" — will render via the generic fallback.`,
      })
    } else {
      // 2. value-shape check (only when type is known and value isn't a ref)
      if (!isReferenceValue(token.rawValue)) {
        const shapeOk = checkValueShape(token.type, token.rawValue)
        if (!shapeOk) {
          issues.push({
            path: token.path,
            severity: 'warning',
            code: 'INVALID_VALUE_FOR_TYPE',
            message: `Token "${token.path}" of $type "${token.type}" has a value that doesn't match the expected shape.`,
          })
        }
      }
    }

    // 3. Dangling references (every reference inside the value).
    for (const refPath of collectReferences(token.rawValue)) {
      if (!tokens.has(refPath)) {
        issues.push({
          path: token.path,
          severity: 'error',
          code: 'DANGLING_REFERENCE',
          message: `Token "${token.path}" references "${refPath}" which does not exist.`,
        })
      }
    }

    // 4. Reference-chain termination: cycles are errors, deep-but-acyclic
    //    chains are warnings (suspicious but not provably wrong).
    const cycleResult = detectCycle(token, tokens)
    if (cycleResult !== null) {
      if (cycleResult.kind === 'cycle') {
        issues.push({
          path: token.path,
          severity: 'error',
          code: 'CYCLIC_REFERENCE',
          message: `Token "${token.path}" is part of a reference cycle: ${cycleResult.loop.join(' → ')}.`,
        })
      } else {
        issues.push({
          path: token.path,
          severity: 'warning',
          code: 'REFERENCE_TOO_DEEP',
          message: `Token "${token.path}" has a reference chain longer than ${MAX_REFERENCE_DEPTH} hops; treated as suspicious (possibly a cycle that the detector could not prove).`,
        })
      }
    }
  }

  return issues
}

/* -------------------------------------------------------------------------- */
/* Value-shape checks                                                         */
/* -------------------------------------------------------------------------- */

/**
 * True if `value` matches the expected shape for the given `$type`.
 *
 * Conservative by design: returns `true` when in doubt so the validator
 * doesn't generate false-positive noise on edge cases. The goal is to catch
 * obvious mistakes (a color token whose value is a number, a typography token
 * whose value is a string), not to enforce every nuance of the spec.
 */
function checkValueShape(type: DtcgType, value: RawValue): boolean {
  switch (type) {
    case 'color':
      return isValidColor(value)
    case 'dimension':
      return isValidDimension(value)
    case 'fontFamily':
      return typeof value === 'string' || Array.isArray(value)
    case 'fontWeight':
      return typeof value === 'number' || typeof value === 'string'
    case 'duration':
      return isValidDuration(value)
    case 'number':
      return typeof value === 'number'
    case 'cubicBezier':
      return Array.isArray(value) && value.length === 4
    case 'typography':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'border':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'transition':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'shadow':
      // Shadow can be a single object or an array of objects (layered shadows).
      return typeof value === 'object' && value !== null
    case 'gradient':
      return Array.isArray(value)
    case 'strokeStyle':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    default:
      // Unknown type — already flagged separately, accept the value.
      return true
  }
}

/**
 * Accept any color form real tooling emits:
 *   - structured W3C draft object ({ colorSpace, components, hex, alpha })
 *   - hex strings: #rgb, #rrggbb, #rrggbbaa (CSS standard, alpha last)
 *   - CSS color functions and keywords, validated via the browser's own parser
 *     when available, falling back to a permissive hex/keyword check in Node.
 */
function isValidColor(value: RawValue): boolean {
  // Structured form (W3C draft).
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return typeof obj.colorSpace === 'string' && Array.isArray(obj.components)
  }
  if (typeof value !== 'string') return false

  // Hex: #rgb, #rrggbb, #rrggbbaa (#aarrggbb is non-standard — rejected).
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
    return true
  }

  // Browser-grade validation for rgb(), hsl(), lab(), oklch(), color(),
  // named colors, etc. `CSS.supports('color', v)` returns true when the value
  // parses as a valid CSS color.
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value)
  }

  // Node fallback: approximate check for CSS color-function syntax. The
  // browser path above delegates to CSS.supports() which fully parses; in
  // Node (or environments without CSS.supports) we accept any function-call
  // form whose args contain at least one number or percentage (rejecting
  // obvious garbage like 'rgb(evil)' or trailing comments). Not a full CSS
  // parser — intentionally permissive about argument counts and ranges,
  // since the design calls for a forgiving validator that flags obvious
  // mistakes rather than enforcing every nuance of the spec.
  return /^[a-z]+\(\s*[^)]*\d[^)]*\s*\)$/i.test(value)
}

/** Dimension: either a bare `0` or a number with a CSS length unit suffix. */
function isValidDimension(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  // Bare 0 is a valid CSS length (unitless 0 is allowed for length properties).
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return true
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc)$/i.test(
    value
  )
}

/** Duration: a number or a string ending in s/ms. */
function isValidDuration(value: RawValue): boolean {
  if (typeof value === 'number') return true
  if (typeof value !== 'string') return false
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:s|ms)$/i.test(value)
}

/* -------------------------------------------------------------------------- */
/* Reference helpers                                                          */
/* -------------------------------------------------------------------------- */

/** True if a value is (or contains) at least one `{...}` reference. */
function isReferenceValue(value: RawValue): boolean {
  return collectReferences(value).length > 0
}

/**
 * Collect every reference path inside a value. Handles:
 *   - top-level reference strings (`"{color.red}"`)
 *   - references inside composite objects (`{ typography: { fontFamily: "{f.sans}" } }`)
 *   - references inside arrays (multi-layer shadows, multi-stop gradients)
 *
 * Composite values may contain both references and literals side-by-side.
 */
function collectReferences(value: RawValue): string[] {
  const refs: string[] = []

  const walk = (v: RawValue): void => {
    if (typeof v === 'string') {
      const parsed = parseReference(v)
      if (parsed !== null) refs.push(parsed)
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item)
    } else if (typeof v === 'object' && v !== null) {
      for (const val of Object.values(v)) walk(val as RawValue)
    }
  }

  walk(value)
  return refs
}

/**
 * Reference-chain termination check. Depth-first walk over every reference
 * reachable from `start` — including references nested inside composite
 * values (typography objects, shadow arrays, etc.). Returns one of:
 *
 *   - `{ kind: 'cycle', loop }` — a path was revisited while still on the
 *     active DFS stack. `loop` is the cyclic segment, for the error message.
 *   - `{ kind: 'too-deep' }` — some walk exceeded MAX_REFERENCE_DEPTH hops
 *     without terminating or repeating. Not provably a cycle, but suspicious
 *     enough to surface as a warning (and a safety net against stack growth).
 *   - `null` — every reachable reference terminates cleanly at a literal, or
 *     hits a dangling reference (reported separately by the dangling check).
 *
 * Composite-aware: a typography token like
 * `{ fontFamily: "{a}", fontSize: "{b}" }` follows both `{a}` and `{b}`.
 * A cycle running through either sub-reference is caught.
 */
type CycleResult =
  | { kind: 'cycle'; loop: string[] }
  | { kind: 'too-deep' }

function detectCycle(
  start: NormalizedToken,
  tokens: TokenMap
): CycleResult | null {
  // DFS with a recursion stack. The stack holds the path from `start` to the
  // current node so we can slice out the cyclic segment when a repeat is hit.
  // `visited` is global to the whole detectCycle call (avoids re-walking
  // acyclic sub-trees from sibling branches), while `onStack` is per-path
  // (only nodes on the current DFS path can close a cycle).
  const visited = new Set<string>([start.path])
  const stack: string[] = [start.path]
  let tooDeep = false

  /**
   * Visit one token's references. Returns a cycle result if found on this
   * branch (or any descendant branch), otherwise null. Mutates `tooDeep`
   * if the depth cap is exceeded.
   */
  function visit(token: NormalizedToken): CycleResult | null {
    const refs = collectReferences(token.rawValue)
    for (const refPath of refs) {
      if (stack.length >= MAX_REFERENCE_DEPTH) {
        tooDeep = true
        continue
      }
      const next = tokens.get(refPath)
      if (next === undefined) continue // dangling — handled elsewhere

      if (stack.includes(next.path)) {
        // Cycle: this branch revisits a node already on the active path.
        const loopStart = stack.indexOf(next.path)
        return { kind: 'cycle', loop: [...stack.slice(loopStart), next.path] }
      }

      if (visited.has(next.path)) {
        // Visited on a sibling branch that didn't cycle — safe to skip.
        // Can't be part of a cycle through this path or it'd be on the stack.
        continue
      }

      visited.add(next.path)
      stack.push(next.path)
      const result = visit(next)
      stack.pop()
      if (result !== null) return result
    }
    return null
  }

  const result = visit(start)
  if (result !== null) return result
  if (tooDeep) return { kind: 'too-deep' }
  return null
}
