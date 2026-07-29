/**
 * Display-name helpers — derive a human-friendly name from a token path.
 *
 * Token paths are dotted (`f.box.modal.shadow`, `shadow.md`) and often carry a
 * trailing type segment (`shadow`, `color`, `font`) that's redundant in a
 * display context. This module produces a short, title-cased label for
 * renderers to show as a heading — mirroring the "primary name" idea from the
 * font family renderer.
 *
 * Pure: no Vue, no I/O. Conservative heuristics — it never invents words (so
 * `md` stays `Md`, not `Medium`); designers who want a richer name can add a
 * `$description` to their tokens.
 */

/**
 * Path segments that purely repeat the token's `$type` and add no descriptive
 * value. Stripped from the END of the path before building the display name.
 * Lowercased for case-insensitive matching.
 */
const TRAILING_TYPE_SEGMENTS = new Set([
  'shadow',
  'color',
  'font',
  'fontfamily',
  'fontweight',
  'dimension',
  'spacing',
  'radius',
  'duration',
  'number',
  'border',
  'gradient',
  'typography',
])

/**
 * Derive a display name from a token's dotted path.
 *
 * Heuristic:
 *   1. Drop segments that are pure type names (`shadow`, `color`, `font`,
 *      etc.) from EITHER END of the path — both `shadow.md` (type prefix) and
 *      `f.box.modal.shadow` (type suffix) are common DTCG/CSS conventions.
 *      Strip at most one from each end so a name like `shadow.box-shadow`
 *      isn't fully consumed.
 *   2. Take the LAST TWO remaining segments (the most specific identity — a
 *      namespace + a name) and convert each to a sentence-cased word. If only
 *      one remains, use it. If the path was only type segments (e.g.
 *      `shadow.color`), keep them all so we don't return an empty name.
 *   3. Join with spaces.
 *
 * Never invents words: `md` stays `Md`, `xl` stays `Xl`. Designers wanting a
 * richer name should add a `$description`.
 *
 * @example
 *   pathToDisplayName('f.box.modal.shadow')   // → 'Box modal'
 *   pathToDisplayName('shadow.md')            // → 'Md'
 *   pathToDisplayName('shadow.focus-ring')    // → 'Focus ring'
 *   pathToDisplayName('color.accent.primary') // → 'Accent primary'
 *   pathToDisplayName('shadow')               // → 'Shadow' (only segment)
 *   pathToDisplayName('')                     // → ''
 */
export function pathToDisplayName(path: string): string {
  if (typeof path !== 'string') return ''
  const segments = path.split('.').filter((s) => s.length > 0)
  if (segments.length === 0) return ''

  // Strip one type-segment from each end (both prefix and suffix conventions).
  let working = [...segments]
  if (working.length > 1) {
    const first = working[0] ?? ''
    const last = working[working.length - 1] ?? ''
    if (TRAILING_TYPE_SEGMENTS.has(first.toLowerCase())) working = working.slice(1)
    if (working.length > 1 && TRAILING_TYPE_SEGMENTS.has(last.toLowerCase())) {
      working = working.slice(0, -1)
    }
  }
  // If stripping emptied the list (path was only type segments), restore.
  if (working.length === 0) working = segments

  // Take the last two remaining segments (most specific identity), join into
  // one phrase, then sentence-case the whole phrase so the name reads as one
  // entity (e.g. `Box modal`, not `Box Modal`).
  const tail = working.slice(-2)
  const phrase = tail.map((seg) => seg.replace(/-/g, ' ')).join(' ')
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
