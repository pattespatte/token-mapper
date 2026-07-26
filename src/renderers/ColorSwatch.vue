<script setup lang="ts">
/**
 * Color renderer.
 *
 * Renders a square swatch filled with the resolved color, plus the value in
 * three common notations: hex, RGB, HSL. Handles:
 *   - 3/6/8-digit hex strings (#rgb, #rrggbb, #rrggbbaa — alpha last per CSS)
 *   - CSS color functions (rgb(), hsl(), oklch(), …) — displayed as the raw
 *     string, swatch filled via CSS which understands them natively
 *   - the W3C draft structured color object — rendered via the swatch using
 *     a best-effort conversion when colorSpace is srgb
 *
 * Translucent colors render over a checkerboard background so alpha is
 * visible. Non-string values (malformed) fall back to a placeholder swatch
 * with a question mark and don't crash the gallery.
 */

import { computed } from 'vue'
import type { RawValue, ResolvedToken } from '@/types/token'

const props = defineProps<{
  token: ResolvedToken
}>()

/**
 * Resolved swatch CSS colour. Uses the value directly when it's a string the
 * browser understands; falls back to a CSS keyword for unsupported shapes so
 * the gallery never shows a broken transparent square.
 */
const swatchColor = computed<string>(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'string') return v
  if (isStructuredColor(v)) {
    // Best-effort: only srgb with 3 components + optional alpha is convertible
    // to an rgb() string here. Other colorSpaces fall through to the keyword.
    const { colorSpace, components, alpha } = v
    if (
      colorSpace === 'srgb' &&
      Array.isArray(components) &&
      components.length >= 3
    ) {
      // Guard each index explicitly — noUncheckedIndexedAccess makes
      // components[i] possibly undefined.
      const r = components[0]
      const g = components[1]
      const b = components[2]
      if (
        typeof r === 'number' &&
        typeof g === 'number' &&
        typeof b === 'number'
      ) {
        // Clamp each channel to its valid range per the W3C DTCG spec:
        // sRGB components are 0–1, alpha is 0–1. Without clamping, malformed
        // components (e.g. [255, 0, 0]) produce rgba(65025, 0, 0, 1) which
        // is invalid CSS the browser silently ignores.
        const clamp = (n: number, min = 0, max = 1) =>
          Math.min(max, Math.max(min, n))
        const cr = Math.round(clamp(r) * 255)
        const cg = Math.round(clamp(g) * 255)
        const cb = Math.round(clamp(b) * 255)
        const a = clamp(typeof alpha === 'number' ? alpha : 1)
        return `rgba(${cr}, ${cg}, ${cb}, ${a})`
      }
    }
  }
  return 'transparent'
})

/** Whether the value is a parseable string or structured color. */
const isRenderable = computed(
  () => swatchColor.value !== 'transparent' || typeof props.token.resolvedValue === 'string'
)

/** Hex form for the value label. Falls back to the raw value if not hex. */
const hexLabel = computed<string>(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : JSON.stringify(v)
})

/**
 * Normalise any CSS color string to a hex form (`#rrggbb` or `#rrggbbaa`),
 * via the canvas 2D context's fillStyle parser. Returns null when the value
 * isn't a string the browser can parse, or when canvas is unavailable
 * (Node test environments). Hex inputs pass through unchanged; rgb()/hsl()/
 * oklch()/named colors all get normalised, so the RGB and HSL labels work
 * for every color form, not just hex.
 */
function normalizeToHex(v: RawValue): string | null {
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
    // it uniformly. (Browsers don't seem to emit hsl() from fillStyle, but
    // guard anyway.)
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

/** RGB notation, when computable from any color form. */
const rgbLabel = computed<string>(() => {
  const hex = normalizeToHex(props.token.resolvedValue)
  const parsed = hex === null ? null : parseHex(hex)
  if (parsed === null) return ''
  const [r, g, b, a] = parsed
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`
})

/** HSL notation, when computable from any color form. */
const hslLabel = computed<string>(() => {
  const hex = normalizeToHex(props.token.resolvedValue)
  const parsed = hex === null ? null : parseHex(hex)
  if (parsed === null) return ''
  const [r, g, b, a] = parsed
  const [h, s, l] = rgbToHsl(r, g, b)
  return a === 1
    ? `hsl(${h}, ${s}%, ${l}%)`
    : `hsla(${h}, ${s}%, ${l}%, ${a})`
})

/** Type guard for the W3C draft structured color object. */
function isStructuredColor(
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
 */
function parseHex(v: RawValue): [number, number, number, number] | null {
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

/** Convert RGB (0–255) to HSL ([h: 0–360, s: 0–100, l: 0–100]). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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
</script>

<template>
  <div class="dtv-color">
    <div
      class="dtv-color__swatch"
      :class="{ 'dtv-color__swatch--placeholder': !isRenderable }"
      :style="{ backgroundColor: swatchColor }"
      :aria-label="`Color swatch for ${token.path}: ${hexLabel}`"
      role="img"
    >
      <span v-if="!isRenderable" class="dtv-color__question">?</span>
    </div>
    <dl class="dtv-color__values">
      <div class="dtv-color__row">
        <dt>hex</dt>
        <dd>{{ hexLabel }}</dd>
      </div>
      <div v-if="rgbLabel" class="dtv-color__row">
        <dt>rgb</dt>
        <dd>{{ rgbLabel }}</dd>
      </div>
      <div v-if="hslLabel" class="dtv-color__row">
        <dt>hsl</dt>
        <dd>{{ hslLabel }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.dtv-color {
  display: flex;
  gap: var(--dtv-spacing-sm);
  align-items: flex-start;
}

.dtv-color__swatch {
  width: 64px;
  height: 64px;
  border-radius: var(--dtv-radius-md);
  flex-shrink: 0;
  border: 1px solid var(--dtv-color-border);
  /*
   * Checkerboard background so translucent colours are visibly translucent.
   * Rendered behind the swatch's backgroundColor via background-blend-mode
   * (or visible whenever backgroundColor has alpha < 1).
   */
  background-image:
    linear-gradient(45deg, var(--dtv-color-border) 25%, transparent 25%),
    linear-gradient(-45deg, var(--dtv-color-border) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--dtv-color-border) 75%),
    linear-gradient(-45deg, transparent 75%, var(--dtv-color-border) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
}

.dtv-color__swatch--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--dtv-color-surface-muted);
  background-image: none;
}

.dtv-color__question {
  font-size: var(--dtv-font-size-lg);
  color: var(--dtv-color-text-subtle);
}

.dtv-color__values {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
}

.dtv-color__row {
  display: flex;
  gap: var(--dtv-spacing-xs);
}

.dtv-color__row dt {
  color: var(--dtv-color-text-subtle);
  width: 2.5em;
  flex-shrink: 0;
}

.dtv-color__row dd {
  margin: 0;
  color: var(--dtv-color-text);
  word-break: break-all;
}
</style>
