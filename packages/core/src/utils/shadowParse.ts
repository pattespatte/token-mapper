/**
 * CSS box-shadow parser — converts a CSS shadow string into the structured
 * DTCG layer shape that {@link ResolvedToken} carries for `$type: 'shadow'`.
 *
 * The structured shape mirrors what JSON-sourced shadows use and what the
 * ShadowPreview renderer expects:
 *
 *   { offsetX, offsetY, blur?, spread?, color?, inset? }
 *
 * Multi-layer shadows (`0 0 1px red, 0 0 2px blue`) become an array of layer
 * objects; single-layer shadows become a one-element array (the renderer
 * accepts both `layer` and `layer[]`).
 *
 * Pure: no Vue, no I/O. Returns `null` for input that doesn't parse as a
 * shadow (the caller keeps the original string).
 */

import { splitTopLevelCommas } from './cssTypeInference'

/**
 * One parsed shadow layer in the canonical DTCG/ShadowPreview shape.
 *
 * Carries an index signature so a layer is assignable to `RawValue`'s object
 * arm — every field is itself a `RawValue` (string / boolean), so the
 * signature is accurate, and it lets the CSS importer assign a parsed layer
 * straight onto `token.rawValue` without a cast.
 */
export interface ShadowLayer {
  offsetX: string
  offsetY: string
  blur?: string
  spread?: string
  color?: string
  inset?: true
  [key: string]: string | true | undefined
}

/**
 * Regex for one `<length>` token (number + unit, or a bare unitless `0`),
 * matching the unit set from {@link cssTypeInference.LENGTH_UNITS}.
 *
 * Note: a `{...}` reference fragment (from the partial-var rewriter) is
 * intentionally NOT matched here. A reference could resolve to a length OR a
 * color depending on its target, so the parser treats it as a non-length
 * token — it ends the leading length run and becomes the trailing color (the
 * most common case for `var()` inside a shadow). The resolver then splices the
 * target value into the structured layer's `color` field.
 */
const LENGTH_TOKEN =
  /^(?:[+-]?0(?:\.0+)?|[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:px|rem|em|ex|ch|lh|rlh|cap|rcap|ic|ric|vi|vb|svh|lvh|dvh|svw|lvw|dvw|cqmin|cqmax|cqw|cqh|cqb|cqi|cql|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc))$/i

/**
 * Parse a CSS box-shadow string into structured layer(s).
 *
 * @returns An array of {@link ShadowLayer} (one element for single-layer,
 *          multiple for comma-separated multi-layer), or `null` when the input
 *          doesn't parse as a shadow.
 *
 * @example
 *   parseCssShadow('0 4px 6px -1px rgba(17,24,39,0.1)')
 *     // → [{ offsetX: '0', offsetY: '4px', blur: '6px', spread: '-1px', color: 'rgba(17,24,39,0.1)' }]
 *   parseCssShadow('inset 0 2px 3px rgba(0,0,0,0.1)')
 *     // → [{ offsetX: '0', offsetY: '2px', blur: '3px', color: 'rgba(0,0,0,0.1)', inset: true }]
 *   parseCssShadow('0 0 1px red, 0 0 2px blue')
 *     // → [{ offsetX: '0', offsetY: '0', blur: '1px', color: 'red' }, { offsetX: '0', offsetY: '0', blur: '2px', color: 'blue' }]
 *   parseCssShadow('not a shadow')   // → null
 */
export function parseCssShadow(value: string): ShadowLayer[] | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null

  const layerStrings = splitTopLevelCommas(trimmed)
  if (layerStrings.length === 0) return null

  const layers: ShadowLayer[] = []
  for (const ls of layerStrings) {
    const layer = parseSingleLayer(ls)
    if (layer === null) return null
    layers.push(layer)
  }
  return layers
}

/**
 * Parse one layer (no top-level commas). Returns the structured layer or `null`
 * when the shape isn't a valid single-layer shadow.
 */
function parseSingleLayer(layer: string): ShadowLayer | null {
  let body = layer
  let inset: true | undefined
  // Strip an optional leading `inset` keyword (case-insensitive).
  const insetMatch = /^inset\s+/i.exec(body)
  if (insetMatch !== null) {
    inset = true
    body = body.slice(insetMatch[0].length)
  }

  const tokens = body.split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length < 2) return null

  // Consume up to 4 leading length tokens: offsetX, offsetY, blur, spread.
  const lengths: string[] = []
  let i = 0
  while (i < tokens.length && i < 4 && LENGTH_TOKEN.test(tokens[i] ?? '')) {
    lengths.push(tokens[i] as string)
    i++
  }
  // The two offsets are required.
  if (lengths.length < 2) return null

  const result: ShadowLayer = {
    offsetX: lengths[0] as string,
    offsetY: lengths[1] as string,
  }
  if (lengths.length >= 3) result.blur = lengths[2]
  if (lengths.length >= 4) result.spread = lengths[3]
  if (inset === true) result.inset = true

  // Remaining tokens (if any) form the colour. Rejoin so `rgba(0, 0, 0, 0.1)`
  // — which contains spaces — is preserved as one string. Note: the
  // splitTopLevelCommas call above already kept function-internal commas intact,
  // so a multi-space color still reassembles correctly.
  if (i < tokens.length) {
    result.color = tokens.slice(i).join(' ')
  }

  return result
}
