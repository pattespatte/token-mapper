/**
 * Font helpers — pure functions for normalising font-weight keywords and
 * extracting the primary family from a font stack.
 *
 * Extracted from the renderers so the font weight/family renderers and any
 * future diff explainer share one implementation (mirrors the `color.ts`
 * convention). The renderers previously had no normalisation; these helpers
 * add the "friendlier label" layer (e.g. `normal` → `400 (normal)`).
 */

/**
 * CSS spec absolute font-weight keyword → numeric mappings (CSS Fonts L4).
 *
 * Only `normal` and `bold` have fixed numeric equivalents. `lighter` and
 * `bolder` are RELATIVE — they resolve against the inherited parent weight via
 * a mapping table, so they cannot be reduced to a single number without
 * knowing the parent context. A design-token renderer has no parent context,
 * so {@link weightKeywordToNumber} returns `null` for them.
 */
const WEIGHT_KEYWORDS: Record<'normal' | 'bold', number> = {
  normal: 400,
  bold: 700,
}

/**
 * Map a CSS font-weight keyword to its absolute numeric equivalent.
 *
 * Returns `400` for `'normal'`, `700` for `'bold'`, and `null` for everything
 * else — including `lighter`/`bolder` (relative, no fixed number) and any
 * non-keyword value (numbers, malformed strings). Case-insensitive on the
 * input to match CSS's own keyword handling.
 *
 * @example
 *   weightKeywordToNumber('normal')   // → 400
 *   weightKeywordToNumber('BOLD')     // → 700
 *   weightKeywordToNumber('lighter')  // → null (relative)
 *   weightKeywordToNumber('400')      // → null (already numeric)
 */
export function weightKeywordToNumber(value: string): number | null {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase() as 'normal' | 'bold'
  return WEIGHT_KEYWORDS[key] ?? null
}

/**
 * Extract the primary family name from a CSS font-family stack.
 *
 * The primary family is the first comma-separated entry (the preferred font),
 * with surrounding quotes stripped and whitespace trimmed. This is the name a
 * designer recognises — e.g. for `'"Inter Variable", sans-serif'` it returns
 * `'Inter Variable'`; for `'"Consolas", "Courier", monospace'` it returns
 * `'Consolas'`; for a bare `'monospace'` it returns `'monospace'`.
 *
 * Returns `''` for empty/non-string input or when the first entry is empty
 * after stripping. Never throws.
 */
export function primaryFontFamily(stack: string): string {
  if (typeof stack !== 'string') return ''
  const trimmed = stack.trim()
  if (trimmed === '') return ''
  const first = trimmed.split(',')[0] ?? ''
  // Strip surrounding single or double quotes (CSS allows either) and trim
  // inner whitespace a quoted name might carry.
  return first.trim().replace(/^["']|["']$/g, '').trim()
}
