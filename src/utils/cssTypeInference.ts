/**
 * CSS type-inference helpers — pure functions for sniffing a value's `$type`
 * from its shape.
 *
 * Extracted verbatim from `src/pipeline/validate.ts` so the validator and
 * the Tier 3 CSS parser share one implementation. The validator previously
 * owned these as module-private helpers; they're now exported from here
 * and the validator imports them. No behaviour change.
 *
 * The new `inferType` helper is the parser-friendly entry point: it returns
 * the inferred `$type` (or `undefined`), whereas the validator calls the
 * individual boolean checks directly because it needs per-type diagnostics.
 */

import type { DtcgType } from '@/types/dtcg'
import type { RawValue } from '@/types/token'

/**
 * Accept any color form real tooling emits:
 *   - structured W3C draft object ({ colorSpace, components, hex, alpha })
 *   - hex strings: #rgb, #rrggbb, #rrggbbaa (CSS standard, alpha last)
 *   - CSS color functions and keywords, validated via the browser's own parser
 *     when available, falling back to a permissive hex/keyword check in Node.
 */
export function isValidColor(value: RawValue): boolean {
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
export function isValidDimension(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  // Bare 0 is a valid CSS length (unitless 0 is allowed for length properties).
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return true
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc)$/i.test(
    value
  )
}

/**
 * Infer a token's `$type` from the shape of its value. Returns `'color'` for
 * any color form, `'dimension'` for CSS lengths, or `undefined` when no rule
 * matches. The caller decides what to do with `undefined` — the CSS parser
 * leaves `$type` unset (the validator then emits `MISSING_TYPE`); other
 * callers may treat it differently.
 *
 * Order matters: color is checked first because hex values like `#000` are
 * unambiguous, then dimension. Future types (fontFamily, duration) would
 * slot in here.
 */
export function inferType(value: RawValue): DtcgType | undefined {
  if (isValidColor(value)) return 'color'
  if (isValidDimension(value)) return 'dimension'
  return undefined
}
