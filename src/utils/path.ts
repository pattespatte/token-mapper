/**
 * Dotted-path utilities for W3C DTCG token paths and references.
 *
 * Per the W3C Design Tokens Format Module, a path is a sequence of segments
 * separated by `.`. A segment that contains `.`, `"`, or whitespace must be
 * wrapped in double quotes; inside a quoted segment, `\` escapes `\` and `"`.
 *
 * Example: the group key `"gray cool"` produces the segment `gray cool`, which
 * joins into `color."gray cool".50` and references as `{color."gray cool".50}`.
 *
 * These helpers are the single source of truth for path stringification —
 * every other module works in terms of `string[]` segments and only calls
 * here to (de)serialize.
 */

/**
 * Regex that identifies segment characters which mandate quoting per the spec:
 * a literal dot, a literal double-quote, or any whitespace character.
 */
const CHARS_REQUIRING_QUOTE = /[."\s]/

/**
 * True if a segment must be wrapped in double quotes when stringified.
 * Empty segments are also quoted so they don't collapse ambiguously.
 */
function needsQuoting(segment: string): boolean {
  return segment === '' || CHARS_REQUIRING_QUOTE.test(segment)
}

/** Escape `\` and `"` inside a quoted segment (spec: backslash is the escaper). */
function escapeQuoted(segment: string): string {
  return segment.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Wrap a single segment in double quotes with proper escaping. */
function quote(segment: string): string {
  return '"' + escapeQuoted(segment) + '"'
}

/**
 * Join path segments into a dotted-path string.
 *
 * @example
 *   joinPath(['color', 'gray cool', '50'])       // → 'color."gray cool".50'
 *   joinPath(['a', 'b.c', 'd'])                  // → 'a."b.c".d'
 *   joinPath(['typography', 'heading'])          // → 'typography.heading'
 *   joinPath([])                                  // → ''
 */
export function joinPath(segments: readonly string[]): string {
  return segments
    .map((segment) => (needsQuoting(segment) ? quote(segment) : segment))
    .join('.')
}

/**
 * Extract the path from a `{...}` reference string, or `null` if the input is
 * not a reference.
 *
 * @example
 *   parseReference('{color.pink.900}')   // → 'color.pink.900'
 *   parseReference('color.pink.900')     // → null
 *   parseReference('#ff0000')            // → null
 */
export function parseReference(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < 2) return null
  if (trimmed.charAt(0) !== '{' || trimmed.charAt(trimmed.length - 1) !== '}') {
    return null
  }
  return trimmed.slice(1, -1)
}
