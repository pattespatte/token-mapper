/**
 * explainDiff — type-aware "changed how?" presentation layer.
 *
 * Pure function that takes two resolved tokens (set A and set B) and returns
 * a structured description of how their values differ. Used by the DiffCard
 * (summary only) and DiffInspector (full details list).
 *
 * Architecture note (PRD decision #1): this is intentionally **separate**
 * from `pipeline/diff.ts`. The engine's single responsibility is to classify
 * token pairs into the four buckets (matching/changed/missing/extra) by
 * deep equality. This module answers the next question — given a `changed`
 * pair, what specifically moved? — without bloating the engine. Both LLM
 * reviews (Claude Sonnet 4.6, GPT-5.2) explicitly recommended this split.
 *
 * Per-type branches:
 *
 *   - color     → RGB distance via `rgbDistance` (basic, not ΔE2000) +
 *                 qualitative label (identical / near / visible / far).
 *   - dimension → old → new, +Δ in original unit, ratio when both nonzero.
 *   - number    → same as dimension, no unit.
 *   - duration  → same as dimension, unit is s/ms.
 *   - typography → per-sub-field diff list (fontSize, fontWeight, …).
 *   - shadow    → layer-by-layer + count delta when layer counts differ.
 *   - border    → per-field diff (width, style, color).
 *   - gradient  → per-stop diff (color, position) + count delta.
 *   - fallback  → JSON-before → JSON-after string pair. Never throws.
 *
 * Defensive everywhere: any branch that throws or fails to parse falls
 * through to the fallback. The UI depends on this always returning something.
 */

import type { RawValue, ResolvedToken } from '@/types/token'
import type { DiffExplanation } from '@/types/diff'
import { normalizeToHex, rgbDistance } from '@/utils/color'

/** Maximum absolute RGB distance (√(3 × 255²) ≈ 441.67). Used to normalise magnitude. */
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255)

/** Distance thresholds for the qualitative color label. */
const COLOR_NEAR_THRESHOLD = 5 // < 5 — basically imperceptible
const COLOR_VISIBLE_THRESHOLD = 25 // < 25 — subtle but noticeable

/** Truncation limit for fallback JSON snippets in `summary`. */
const SUMMARY_MAX_CHARS = 30

/**
 * Produce a DiffExplanation for a `changed` token pair. Pure: no Vue, no I/O,
 * no side effects. Never throws — falls back to a JSON before/after summary
 * when the per-type branch fails or values don't match expectations.
 *
 * Both inputs must be present (the `changed` bucket guarantees this), but
 * the function is defensive in case a caller passes a missing side.
 */
export function explainDiff(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  // Defensive: if types differ between A and B, lead with that.
  if (a.type !== b.type) {
    return {
      summary: 'type changed',
      details: [
        { label: 'type', before: a.type ?? 'unknown', after: b.type ?? 'unknown' },
      ],
    }
  }

  try {
    switch (a.type) {
      case 'color':
        return explainColor(a, b)
      case 'dimension':
        return explainDimension(a, b)
      case 'number':
        return explainNumeric(a, b, '')
      case 'duration':
        return explainNumeric(a, b, '') // unit is part of the value already
      case 'typography':
        return explainObjectFields(a, b, 'field')
      case 'border':
        return explainObjectFields(a, b, 'field')
      case 'shadow':
        return explainShadow(a, b)
      case 'gradient':
        return explainGradient(a, b)
      default:
        return explainFallback(a, b)
    }
  } catch {
    // Any unexpected failure → fallback so the UI never crashes.
    return explainFallback(a, b)
  }
}

/* --------------------------------- color --------------------------------- */

function explainColor(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  const distance = rgbDistance(a.resolvedValue, b.resolvedValue)
  if (distance === null) {
    return explainFallback(a, b)
  }

  const label =
    distance === 0
      ? 'identical' // shouldn't happen for `changed` tokens but be safe
      : distance < COLOR_NEAR_THRESHOLD
      ? 'near'
      : distance < COLOR_VISIBLE_THRESHOLD
      ? 'visible'
      : 'far'

  const hexA = normalizeToHex(a.resolvedValue) ?? String(a.resolvedValue)
  const hexB = normalizeToHex(b.resolvedValue) ?? String(b.resolvedValue)

  return {
    summary: `Δ${Math.round(distance)}`,
    details: [
      { label: 'color', before: hexA, after: hexB },
      { label: 'distance', before: '0', after: `${Math.round(distance)} (${label})` },
    ],
    magnitude: distance / MAX_RGB_DISTANCE,
  }
}

/* ------------------------------ dimension -------------------------------- */

/**
 * Matches a CSS length value: bare 0, or <number><unit>. Returns the numeric
 * part and the unit separately so deltas carry the original unit through.
 * Mirrors the validator's regex (`validate.ts:212-219`).
 */
function parseLength(v: RawValue): { value: number; unit: string } | null {
  if (typeof v === 'number') return { value: v, unit: '' }
  if (typeof v !== 'string') return null
  if (/^[+-]?0(?:\.0+)?$/.test(v)) return { value: 0, unit: '' }
  const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(px|rem|em|ex|ch|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc)?$/i.exec(v)
  if (m === null) return null
  const num = parseFloat(m[1] ?? '')
  const unit = (m[2] ?? '').toLowerCase()
  if (Number.isNaN(num)) return null
  return { value: num, unit }
}

function explainDimension(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  const before = parseLength(a.resolvedValue)
  const after = parseLength(b.resolvedValue)
  if (before === null || after === null) {
    return explainFallback(a, b)
  }

  const delta = after.value - before.value
  // Use whichever unit is present (prefer `after` so the new value's unit wins
  // on a unit change like `16px` → `1rem`).
  const unit = after.unit || before.unit
  const sign = delta > 0 ? '+' : ''
  const summary = `${sign}${roundForDisplay(delta)}${unit}`
  const details: DiffExplanation['details'] = [
    {
      label: 'value',
      before: `${roundForDisplay(before.value)}${before.unit}`,
      after: `${roundForDisplay(after.value)}${after.unit}`,
    },
    { label: 'delta', before: '', after: summary },
  ]
  if (before.value !== 0 && after.unit === before.unit) {
    const ratio = after.value / before.value
    details.push({ label: 'ratio', before: '', after: `${roundForDisplay(ratio)}×` })
  }
  return { summary, details }
}

/** Same as dimension but with no unit concept — pure numeric delta. */
function explainNumeric(
  a: ResolvedToken,
  b: ResolvedToken,
  _unit: string
): DiffExplanation {
  const av = a.resolvedValue
  const bv = b.resolvedValue
  if (typeof av !== 'number' || typeof bv !== 'number') {
    // Duration is often a string like "200ms"; parse the numeric part.
    if (typeof av === 'string' && typeof bv === 'string') {
      const an = parseFloat(av)
      const bn = parseFloat(bv)
      if (!Number.isNaN(an) && !Number.isNaN(bn)) {
        return numericDelta(an, bn, av, bv)
      }
    }
    return explainFallback(a, b)
  }
  return numericDelta(av, bv, String(av), String(bv))
}

function numericDelta(
  before: number,
  after: number,
  beforeStr: string,
  afterStr: string
): DiffExplanation {
  const delta = after - before
  const sign = delta > 0 ? '+' : ''
  const summary = `${sign}${roundForDisplay(delta)}`
  const details: DiffExplanation['details'] = [
    { label: 'value', before: beforeStr, after: afterStr },
    { label: 'delta', before: '', after: summary },
  ]
  if (before !== 0) {
    details.push({
      label: 'ratio',
      before: '',
      after: `${roundForDisplay(after / before)}×`,
    })
  }
  return { summary, details }
}

/* -------------------------- typography / border -------------------------- */

/**
 * Generic per-field diff for object-valued tokens (typography, border).
 * For each key in the union of both objects' keys, compare the before/after
 * values; include only changed keys in the details list.
 */
function explainObjectFields(
  a: ResolvedToken,
  b: ResolvedToken,
  fieldLabel: string
): DiffExplanation {
  const av = a.resolvedValue
  const bv = b.resolvedValue
  if (typeof av !== 'object' || av === null || Array.isArray(av)) {
    return explainFallback(a, b)
  }
  if (typeof bv !== 'object' || bv === null || Array.isArray(bv)) {
    return explainFallback(a, b)
  }

  const aObj = av as Record<string, RawValue>
  const bObj = bv as Record<string, RawValue>
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])

  const details: DiffExplanation['details'] = []
  for (const key of keys) {
    const before = aObj[key]
    const after = bObj[key]
    if (!rawValuesEqual(before, after)) {
      // before undefined → field was ADDED in B (we didn't have it before).
      // after undefined → field was REMOVED in B (we don't have it anymore).
      details.push({
        label: key,
        before: before === undefined ? '(added)' : formatValue(before),
        after: after === undefined ? '(removed)' : formatValue(after),
      })
    }
  }

  if (details.length === 0) {
    return explainFallback(a, b) // shouldn't happen for changed tokens
  }
  const count = details.length
  return {
    summary: `${count} ${fieldLabel}${count === 1 ? '' : 's'}`,
    details,
  }
}

/* -------------------------------- shadow --------------------------------- */

interface ShadowLayer {
  offsetX?: RawValue
  offsetY?: RawValue
  blur?: RawValue
  spread?: RawValue
  color?: RawValue
  inset?: RawValue
}

function parseShadowLayers(v: RawValue): ShadowLayer[] {
  if (Array.isArray(v)) {
    return v.filter(
      (item): item is Record<string, RawValue> => typeof item === 'object' && item !== null
    ) as unknown as ShadowLayer[]
  }
  if (typeof v === 'object' && v !== null) {
    return [v as unknown as ShadowLayer]
  }
  return []
}

function explainShadow(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  const aLayers = parseShadowLayers(a.resolvedValue)
  const bLayers = parseShadowLayers(b.resolvedValue)

  if (aLayers.length === 0 || bLayers.length === 0) {
    return explainFallback(a, b)
  }

  const details: DiffExplanation['details'] = []
  const minLen = Math.min(aLayers.length, bLayers.length)
  for (let i = 0; i < minLen; i++) {
    const aLayer = aLayers[i]
    const bLayer = bLayers[i]
    if (aLayer === undefined || bLayer === undefined) continue
    const prefix = aLayers.length > 1 || bLayers.length > 1 ? `L${i + 1} ` : ''
    const changed = compareLayerFields(prefix, aLayer, bLayer)
    details.push(...changed)
  }
  if (aLayers.length !== bLayers.length) {
    details.push({
      label: 'layers',
      before: String(aLayers.length),
      after: String(bLayers.length),
    })
  }

  if (details.length === 0) {
    return explainFallback(a, b)
  }

  const summary =
    aLayers.length !== bLayers.length
      ? `${Math.min(aLayers.length, bLayers.length)}→${Math.max(aLayers.length, bLayers.length)} layers`
      : `${details.length} field${details.length === 1 ? '' : 's'}`
  return { summary, details }
}

/** Compare common shadow/border sub-fields between two layers. */
function compareLayerFields(
  prefix: string,
  a: ShadowLayer,
  b: ShadowLayer
): { label: string; before: string; after: string }[] {
  const out: { label: string; before: string; after: string }[] = []
  const fields: (keyof ShadowLayer)[] = [
    'offsetX',
    'offsetY',
    'blur',
    'spread',
    'color',
    'inset',
  ]
  for (const f of fields) {
    const av = a[f]
    const bv = b[f]
    if (!rawValuesEqual(av, bv)) {
      out.push({
        label: `${prefix}${f}`,
        before: av === undefined ? '—' : formatValue(av),
        after: bv === undefined ? '—' : formatValue(bv),
      })
    }
  }
  return out
}

/* ------------------------------- gradient -------------------------------- */

interface GradientStop {
  color?: RawValue
  position?: RawValue
}

function parseGradientStops(v: RawValue): GradientStop[] {
  if (Array.isArray(v)) {
    return v.filter(
      (s): s is Record<string, RawValue> => typeof s === 'object' && s !== null
    ) as unknown as GradientStop[]
  }
  // Wrapping object: { type, angle, stops }
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    const obj = v as { stops?: unknown }
    if (Array.isArray(obj.stops)) {
      return obj.stops.filter(
        (s): s is Record<string, RawValue> => typeof s === 'object' && s !== null
      ) as unknown as GradientStop[]
    }
  }
  return []
}

function explainGradient(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  const aStops = parseGradientStops(a.resolvedValue)
  const bStops = parseGradientStops(b.resolvedValue)

  if (aStops.length === 0 || bStops.length === 0) {
    return explainFallback(a, b)
  }

  const details: DiffExplanation['details'] = []
  const minLen = Math.min(aStops.length, bStops.length)
  for (let i = 0; i < minLen; i++) {
    const aStop = aStops[i]
    const bStop = bStops[i]
    if (aStop === undefined || bStop === undefined) continue
    const prefix = aStops.length > 1 || bStops.length > 1 ? `S${i + 1} ` : ''
    if (!rawValuesEqual(aStop.color, bStop.color)) {
      details.push({
        label: `${prefix}color`,
        before: aStop.color === undefined ? '—' : formatValue(aStop.color),
        after: bStop.color === undefined ? '—' : formatValue(bStop.color),
      })
    }
    if (!rawValuesEqual(aStop.position, bStop.position)) {
      details.push({
        label: `${prefix}position`,
        before: aStop.position === undefined ? '—' : formatValue(aStop.position),
        after: bStop.position === undefined ? '—' : formatValue(bStop.position),
      })
    }
  }
  if (aStops.length !== bStops.length) {
    details.push({
      label: 'stops',
      before: String(aStops.length),
      after: String(bStops.length),
    })
  }

  if (details.length === 0) {
    return explainFallback(a, b)
  }
  const summary =
    aStops.length !== bStops.length
      ? `${Math.min(aStops.length, bStops.length)}→${Math.max(aStops.length, bStops.length)} stops`
      : `${details.length} field${details.length === 1 ? '' : 's'}`
  return { summary, details }
}

/* ------------------------------- fallback -------------------------------- */

function explainFallback(a: ResolvedToken, b: ResolvedToken): DiffExplanation {
  const before = truncate(formatValue(a.resolvedValue), SUMMARY_MAX_CHARS)
  const after = truncate(formatValue(b.resolvedValue), SUMMARY_MAX_CHARS)
  return {
    summary: `${before} → ${after}`,
    details: [
      { label: 'value', before, after },
    ],
  }
}

/* ------------------------------ shared utils ----------------------------- */

/**
 * Structural equality check for two RawValues used during field diffing.
 * Deliberately simpler than the diff engine's `deepEqual` (we don't need
 * cycle handling or type-tagging here — both values came from the same key
 * path on the same shape of object).
 */
function rawValuesEqual(a: RawValue | undefined, b: RawValue | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b as object)
    if (aKeys.length !== bKeys.length) return false
    for (const k of aKeys) {
      if (!rawValuesEqual((a as Record<string, RawValue>)[k], (b as Record<string, RawValue>)[k])) {
        return false
      }
    }
    return true
  }
  return false
}

/** Format a raw value for human display (JSON for objects, string for primitives). */
function formatValue(v: RawValue): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Truncate a string to `max` chars with an ellipsis when it overflows. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

/** Round a number for display, dropping trailing zeros (12.00 → 12, 12.50 → 12.5). */
function roundForDisplay(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Two decimals is enough for design-token deltas; strip trailing zeros.
  return n.toFixed(2).replace(/\.?0+$/, '')
}
