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

import type { DtcgType } from '../types/dtcg'
import type { RawValue } from '../types/token'

/**
 * CSS `<length>` unit suffixes this recogniser accepts. Sourced from the CSS
 * Values and Units spec — the full set in current real-world use, not just the
 * classic four. Used both by {@link isValidDimension} (whole value match) and
 * by {@link isValidShadow} (per-token match, via {@link LENGTH_TOKEN}).
 *
 * The baroque-looking ordering matters: within the regex alternation, longer
 * suffixes must precede shorter ones they contain as a prefix, otherwise the
 * engine stops at the shorter match and leaves trailing characters that fail
 * the overall anchored match. Concretely `cqmin`/`cqmax` before `cqi`/`cqb`;
 * `svh`/`lvh`/`dvh` are unambiguous so their order is irrelevant.
 */
const LENGTH_UNITS =
  'px|rem|em|ex|ch|lh|rlh|cap|rcap|ic|ric|vi|vb|' +
  'svh|lvh|dvh|svw|lvw|dvw|' +
  'cqmin|cqmax|cqw|cqh|cqb|cqi|cql|' +
  'vw|vh|vmin|vmax|%|in|cm|mm|pt|pc'

/**
 * One `<length>` token (number + unit, or a bare unitless `0` — which CSS
 * permits for length properties). Used by {@link isValidShadow} to match each
 * offset/blur/spread token individually (e.g. the `0` offsets in
 * `0 0 20px black`). Anchored so a single token is the whole string.
 */
const LENGTH_TOKEN =
  /^(?:[+-]?0(?:\.0+)?|[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:px|rem|em|ex|ch|lh|rlh|cap|rcap|ic|ric|vi|vb|svh|lvh|dvh|svw|lvw|dvw|cqmin|cqmax|cqw|cqh|cqb|cqi|cql|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc))$/i

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

/**
 * Dimension: either a bare `0` (with optional sign) or a number with a CSS
 * length unit suffix. The unit list ({@link LENGTH_UNITS}) covers the full
 * CSS Values and Units `<length>` production in current use — including
 * modern units like `lh`, `cap`, `ic`, the small/large/dynamic viewport units
 * (`svh`/`lvh`/`dvh`), and the container-query length units (`cqw`/`cqh`/…).
 * A leading sign is accepted so negative lengths like `-0.3px` match.
 */
export function isValidDimension(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  // Bare 0 is a valid CSS length (unitless 0 is allowed for length properties).
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return true
  return new RegExp(`^[-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?\\s*(?:${LENGTH_UNITS})$`, 'i').test(value)
}

/**
 * Generic-family keywords that terminate a CSS font-family list. The presence
 * of one of these (as the final comma-separated token) is a strong signal that
 * the value is a font stack. Source: CSS Fonts level 4.
 */
const GENERIC_FAMILIES = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
  'fangsong',
])

/**
 * Font family: a CSS font stack. Recognised when EITHER the value contains a
 * quoted font name (`"…"` / `'…'`) OR its final comma-separated token is a
 * generic-family keyword (`sans-serif`, `monospace`, etc.).
 *
 * Single unquoted names (e.g. `Arial`) are intentionally NOT matched — they're
 * too ambiguous (could be a keyword, an identifier, a class). Quoted stacks and
 * generic-keyword terminators are the unambiguous shapes real design systems
 * emit.
 */
export function isValidFontFamily(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  // Quoted font name anywhere in the value.
  if (/["'][^"']+["']/.test(value)) return true
  // Final comma-separated token is a generic family.
  const parts = value.split(',')
  const last = (parts[parts.length - 1] ?? '').trim().toLowerCase()
  return GENERIC_FAMILIES.has(last)
}

/**
 * Font weight: a CSS font-weight value. Accepts bare integers in the spec
 * range 1–1000 (the common 100–900 multiples are the subset real systems use,
 * but the full range is accepted to avoid false negatives) plus the keywords
 * `normal`, `bold`, `lighter`, `bolder`.
 *
 * Position in {@link inferType}: BEFORE `isValidNumber`. `400` is numerically a
 * bare number but semantically a weight — order resolves the overlap.
 */
export function isValidFontWeight(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  if (/^(?:normal|bold|lighter|bolder)$/.test(value)) return true
  // Bare integer 1–1000. Reject leading zeros (except 1000 itself isn't a
  // leading-zero case) and decimals — font weights are integers.
  return /^(?:1000|[1-9]\d{0,2})$/.test(value)
}

/**
 * Number: any bare numeric (integer or decimal, optionally signed with an
 * optional exponent). The catch-all for numerics not consumed by
 * {@link isValidFontWeight} — z-index, opacity ratios, flex-grow, line-height
 * multipliers, etc.
 *
 * Position in {@link inferType}: AFTER fontWeight, so `400` resolves to a
 * weight while `2.5` resolves to a number.
 */
export function isValidNumber(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  return /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)
}

/**
 * Shadow: a single-layer CSS box-shadow value. The shape is an optional
 * leading `inset`, then 2–4 whitespace-separated length tokens (offset-x,
 * offset-y, optional blur, optional spread — each matching {@link LENGTH_TOKEN}),
 * then an optional trailing colour token.
 *
 * Multi-layer shadows (comma-separated: `0 0 1px red, 0 0 2px blue`) are
 * intentionally rejected — they'd conflict with the {@link isValidFontFamily}
 * comma rule if naively matched, and are left to a future pass.
 *
 * Position in {@link inferType}: AFTER dimension, so a lone length like `16px`
 * stays a dimension rather than being misread as a one-element shadow.
 */
export function isValidShadow(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  // Multi-layer (comma-separated) shadows are out of scope. But commas inside
  // function calls — rgb(0,0,0,0.3), rgba(...), hsl(...) — are part of the
  // colour, not a layer separator. Reject only commas at the top level (outside
  // any parentheses).
  if (hasTopLevelComma(value)) return false
  // Strip an optional leading `inset` (case-insensitive, with trailing space).
  const body = value.replace(/^inset\s+/i, '')
  // Split on whitespace. Up to 4 leading tokens are lengths (offset-x, offset-y,
  // optional blur, optional spread); anything after is the optional colour. The
  // leading run of lengths must be contiguous (no colour interleaved) and at
  // least 2 (the two required offsets).
  const tokens = body.split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length < 2) return false
  let lengthCount = 0
  for (let i = 0; i < tokens.length && i < 4; i++) {
    const tok = tokens[i] ?? ''
    if (LENGTH_TOKEN.test(tok)) {
      lengthCount++
    } else {
      // First non-length token: this is where the colour begins. The length
      // run must have been contiguous from the start and ≥ 2.
      break
    }
  }
  if (lengthCount < 2) return false
  // Everything after the length run (if anything) is the colour — accept any
  // trailing shape; colour validity is enforced downstream.
  return true
}

/**
 * True when `value` contains a comma at depth 0 (not nested inside any
 * parentheses). Used by {@link isValidShadow} to distinguish a multi-layer
 * shadow separator (`0 0 1px red, 0 0 2px blue`) from a comma inside a colour
 * function (`rgb(0, 0, 0)`).
 */
function hasTopLevelComma(value: string): boolean {
  let depth = 0
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) return true
  }
  return false
}

/**
 * Duration: a CSS `<time>` value — `Nms` or `Ns` (optionally fractional and
 * signed). Pure time only; composite transitions like
 * `all 400ms cubic-bezier(...) 0s` are rejected (they contain spaces and
 * non-time tokens) and left for future composite-type work.
 */
export function isValidDuration(value: RawValue): boolean {
  if (typeof value !== 'string') return false
  return /^[+-]?\d+(?:\.\d+)?(?:ms|s)$/i.test(value)
}

/**
 * Infer a token's `$type` from the shape of its value. Returns the first
 * matching DTCG type, or `undefined` when no rule matches.
 *
 * Order is load-bearing — several shapes overlap, and the cascade resolves the
 * ambiguity by specificity:
 *   1. `color`     — hex, rgb(), named colours (unambiguous, first).
 *   2. `dimension` — lengths incl. modern units (`lh`, `dvh`, `cqi`, …).
 *   3. `fontFamily`— quoted stacks / generic-family terminators.
 *   4. `fontWeight`— 1–1000 + keywords, BEFORE number (400 is numeric).
 *   5. `number`    — residual bare numerics (z-index, opacity ratios, …).
 *   6. `shadow`    — 2+ length tokens, AFTER dimension (lone length ≠ shadow).
 *   7. `duration`  — `Nms` / `Ns`.
 *
 * The caller decides what to do with `undefined` — the CSS parser leaves
 * `$type` unset (the validator then emits `MISSING_TYPE`).
 */
export function inferType(value: RawValue): DtcgType | undefined {
  if (isValidColor(value)) return 'color'
  if (isValidDimension(value)) return 'dimension'
  if (isValidFontFamily(value)) return 'fontFamily'
  if (isValidFontWeight(value)) return 'fontWeight'
  if (isValidNumber(value)) return 'number'
  if (isValidShadow(value)) return 'shadow'
  if (isValidDuration(value)) return 'duration'
  return undefined
}
