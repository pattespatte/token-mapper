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
 * Swatch layout:
 *   - Opaque colors fill the whole square solid (no chess) — maximum color
 *     impact, the way you'd see the color in a picker.
 *   - Translucent colors (alpha < 1) render as a 50/50 split: the left half
 *     is the solid opaque hue, the right half is the translucent color over a
 *     checkerboard so the alpha is visible. Conventional design-tool behavior.
 *
 * Non-string values (malformed) fall back to a placeholder swatch with a
 * question mark and don't crash the gallery.
 */

import { computed, type CSSProperties } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'
import {
  isStructuredColor,
  normalizeToHex,
  parseHex,
  rgbToHsl,
} from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** RGBA channels in 0–255 / 0–1, or null when the value can't be parsed. */
const channels = computed<[number, number, number, number] | null>(() => {
  const v = props.token.resolvedValue
  // Structured color: only srgb with ≥3 components is convertible here.
  if (isStructuredColor(v)) {
    const { colorSpace, components, alpha } = v
    if (
      colorSpace === 'srgb' &&
      Array.isArray(components) &&
      components.length >= 3
    ) {
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
        return [
          Math.round(clamp(r) * 255),
          Math.round(clamp(g) * 255),
          Math.round(clamp(b) * 255),
          clamp(typeof alpha === 'number' ? alpha : 1),
        ]
      }
    }
    return null
  }
  // String form: normalise via the canvas parser so rgb()/hsl()/oklch()/named
  // colors all resolve to a hex we can pull alpha from.
  if (typeof v === 'string') {
    const hex = normalizeToHex(v)
    return hex === null ? null : parseHex(hex)
  }
  return null
})

/** True when the resolved color has alpha < 1 (gates the split + chess). */
const isTranslucent = computed(() => {
  const c = channels.value
  return c !== null && c[3] < 1
})

/**
 * The CSS color string for the translucent half — the original resolved
 * value when it's a string the browser understands, otherwise the rgba()
 * built from parsed channels. Falls back to `'transparent'` for unsupported
 * shapes so the gallery never shows a broken square.
 */
const translucentColor = computed<string>(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'string') return v
  const c = channels.value
  if (c !== null) {
    const [r, g, b, a] = c
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return 'transparent'
})

/**
 * The opaque form of the hue (alpha forced to 1). Paints the solid left half
 * for translucent colors, and the whole square for opaque colors. Falls back
 * to the translucent color string when channels can't be parsed — so a CSS
 * color function we can't normalise still renders via the browser's parser.
 */
const opaqueColor = computed<string>(() => {
  const c = channels.value
  if (c !== null) {
    const [r, g, b] = c
    return `rgb(${r}, ${g}, ${b})`
  }
  return translucentColor.value
})

/** Inline style for the swatch element. */
const swatchStyle = computed<CSSProperties>(() => ({
  // The translucent color paints the right half (over the chess). The opaque
  // color covers the left half via the ::before pseudo-element in <style>,
  // fed through the --dtm-swatch-opaque custom property.
  backgroundColor: translucentColor.value,
  '--dtm-swatch-opaque': opaqueColor.value,
}))

/** Whether the value is a parseable string or structured color. */
const isRenderable = computed(
  () => translucentColor.value !== 'transparent' || typeof props.token.resolvedValue === 'string'
)

/** Hex form for the value label. Falls back to the raw value if not hex. */
const hexLabel = computed<string>(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : JSON.stringify(v)
})

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
</script>

<template>
  <div class="dtm-color">
    <div
      class="dtm-color__swatch"
      :class="{
        'dtm-color__swatch--translucent': isTranslucent,
        'dtm-color__swatch--placeholder': !isRenderable,
      }"
      :style="swatchStyle"
      :aria-label="`Color swatch for ${token.path}: ${hexLabel}`"
      role="img"
    >
      <span v-if="!isRenderable" class="dtm-color__question">?</span>
    </div>
    <dl class="dtm-color__values">
      <div class="dtm-color__row">
        <dt>hex</dt>
        <dd>{{ hexLabel }}</dd>
      </div>
      <div v-if="rgbLabel" class="dtm-color__row">
        <dt>rgb</dt>
        <dd>{{ rgbLabel }}</dd>
      </div>
      <div v-if="hslLabel" class="dtm-color__row">
        <dt>hsl</dt>
        <dd>{{ hslLabel }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.dtm-color {
  display: flex;
  gap: var(--dtm-spacing-sm);
  align-items: flex-start;
}

.dtm-color__swatch {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: var(--dtm-radius-md);
  flex-shrink: 0;
  border: 1px solid var(--dtm-color-border);
  /* overflow:hidden keeps the ::before's solid half inside the rounded box. */
  overflow: hidden;
}

/*
 * Translucent variant: a 50/50 split. The element's backgroundColor (the
 * translucent color, bound inline) paints the right half over the chess; the
 * ::before paints the left half with the opaque hue so the pure color reads
 * at full impact. The chess sits behind, visible only on the right half
 * where ::before doesn't cover it.
 */
.dtm-color__swatch--translucent {
  background-image:
    linear-gradient(45deg, var(--dtm-color-border) 25%, transparent 25%),
    linear-gradient(-45deg, var(--dtm-color-border) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--dtm-color-border) 75%),
    linear-gradient(-45deg, transparent 75%, var(--dtm-color-border) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
}

/* Solid left half for translucent swatches. opacityColor is passed via a
   custom property so scoped CSS can consume it without `v-bind` churn. */
.dtm-color__swatch--translucent::before {
  content: '';
  position: absolute;
  inset: 0 50% 0 0;
  background-color: var(--dtm-swatch-opaque, transparent);
}

.dtm-color__swatch--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--dtm-color-surface-muted);
  background-image: none;
}

.dtm-color__question {
  font-size: var(--dtm-font-size-lg);
  color: var(--dtm-color-text-subtle);
}

.dtm-color__values {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
}

.dtm-color__row {
  display: flex;
  gap: var(--dtm-spacing-xs);
}

.dtm-color__row dt {
  color: var(--dtm-color-text-subtle);
  width: 2.5em;
  flex-shrink: 0;
}

.dtm-color__row dd {
  margin: 0;
  color: var(--dtm-color-text);
  word-break: break-all;
}
</style>
