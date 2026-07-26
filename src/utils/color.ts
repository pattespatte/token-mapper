/**
 * Color helpers — pure functions for parsing, normalising, and comparing
 * CSS colors in the forms real DTCG tooling emits.
 *
 * Extracted verbatim from `src/renderers/ColorSwatch.vue` so the renderer
 * and the Tier 2 diff explainer share one implementation. The renderer
 * previously owned these as module-private helpers; they're now exported
 * from here and the renderer imports them.
 *
 * No behaviour change vs the previous in-component definitions — verified
 * by re-running the renderer's existing behaviour plus the new unit tests
 * in `tests/utils/color.test.ts`.
 */

import type { RawValue } from '@/types/token'

/**
 * Type guard for the W3C draft structured color object.
 *
 *   { colorSpace: string, components: number[], alpha?: number }
 */
export function isStructuredColor(
  v: RawValue
): v is { colorSpace: string; components: number[]; alpha?: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { colorSpace?: unknown }).colorSpace === 'string' &&
    Array.isArray((v as { components?: unknown }).components)
  )
}

/**
 * Parse a hex string (#rgb, #rrggbb, #rrggbbaa) into [r, g, b, a] with
 * channels in 0–255 and alpha in 0–1. Returns null for non-hex input.
 *
 * Alpha is the last two chars per CSS standard (#rrggbbaa, NOT #aarrggbb).
 */
export function parseHex(v: RawValue): [number, number, number, number] | null {
  if (typeof v !== 'string') return null
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(v)
  if (match === null) return null
  const digits = match[1] ?? ''

  if (digits.length === 3) {
    const r = digits.charAt(0)
    const g = digits.charAt(1)
    const b = digits.charAt(2)
    return [
      parseInt(r + r, 16),
      parseInt(g + g, 16),
      parseInt(b + b, 16),
      1,
    ]
  }

  const r = digits.slice(0, 2)
  const g = digits.slice(2, 4)
  const b = digits.slice(4, 6)
  if (digits.length === 6) {
    return [
      parseInt(r, 16),
      parseInt(g, 16),
      parseInt(b, 16),
      1,
    ]
  }

  // 8-digit: alpha is the last two chars (CSS standard).
  const a = digits.slice(6, 8)
  return [
    parseInt(r, 16),
    parseInt(g, 16),
    parseInt(b, 16),
    parseInt(a, 16) / 255,
  ]
}

/**
 * Normalise any CSS color string to a hex form (`#rrggbb` or `#rrggbbaa`),
 * via the canvas 2D context's fillStyle parser. Returns null when the value
 * isn't a string the browser can parse, or when canvas is unavailable
 * (Node test environments).
 *
 * Hex inputs pass through unchanged; rgb() / hsl() / oklch() / named colors
 * all get normalised.
 */
export function normalizeToHex(v: RawValue): string | null {
  if (typeof v !== 'string') return null
  // Fast path: already a hex string we can hand straight to parseHex.
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx === null) return null
    // fillStyle normalises any valid CSS color to either #rrggbb or
    // rgba(r, g, b, a) on read-back. Invalid input leaves fillStyle unchanged.
    // Set a sentinel first so we can detect the unchanged case.
    ctx.fillStyle = '#deadbe'
    ctx.fillStyle = v
    const normalized = ctx.fillStyle
    if (normalized === '#deadbe') {
      // Didn't change — either parse failed OR the input really was #deadbe.
      // The latter is vanishingly unlikely in a token file; treat as invalid.
      return null
    }
    // Browser may normalise opaque colors to #rrggbb and translucent ones to
    // rgba(). For the rgba() form, re-format to #rrggbbaa so parseHex handles
    // it uniformly.
    const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(normalized)
    if (rgbaMatch !== null) {
      const parts = (rgbaMatch[1] ?? '')
        .split(',')
        .map((p) => parseFloat(p.trim()))
      if (parts.length >= 3) {
        const r = parts[0]
        const g = parts[1]
        const b = parts[2]
        const a = parts[3] ?? 1
        if (
          r !== undefined &&
          g !== undefined &&
          b !== undefined &&
          ![r, g, b].some(Number.isNaN)
        ) {
          const hex = `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
          const alpha = Math.round(a * 255).toString(16).padStart(2, '0')
          return a === 1 ? hex : hex + alpha
        }
      }
    }
    return /^#[0-9a-fA-F]{6,8}$/.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

/**
 * Convert RGB (0–255) to HSL ([h: 0–360, s: 0–100, l: 0–100]).
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) {
      h = (gn - bn) / d + (gn < bn ? 6 : 0)
    } else if (max === gn) {
      h = (bn - rn) / d + 2
    } else {
      h = (rn - gn) / d + 4
    }
    h *= 60
  }

  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

/**
 * Euclidean RGB distance between two colors — sqrt of summed squared
 * channel deltas. Range is [0, √(3 × 255²)] ≈ [0, 441].
 *
 * Used by the Tier 2 diff explainer as a "is this a visible change?"
 * signal. Cheaper and good-enough vs proper ΔE2000 (which is ~80 lines
 * of colour science for marginal UX gain — decision recorded in PRD).
 *
 * Returns null when either input doesn't parse to a hex color.
 */
export function rgbDistance(
  a: RawValue,
  b: RawValue
): number | null {
  const hexA = normalizeToHex(a)
  const hexB = normalizeToHex(b)
  if (hexA === null || hexB === null) return null
  const parsedA = parseHex(hexA)
  const parsedB = parseHex(hexB)
  if (parsedA === null || parsedB === null) return null
  const [ar, ag, ab] = parsedA
  const [br, bg, bb] = parsedB
  const dr = ar - br
  const dg = ag - bg
  const db = ab - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
