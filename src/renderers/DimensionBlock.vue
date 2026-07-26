<script setup lang="ts">
/**
 * Dimension renderer — handles both spacing and radius.
 *
 * Spacing tokens (path starts with `spacing.`) render as a horizontal bar
 * whose width equals the resolved value. Radius tokens (path starts with
 * `radius.`) render as a square whose corner radius equals the resolved
 * value. Other dimension tokens default to the bar style.
 *
 * The resolved value is used directly as a CSS length (`4px` → 4px bar).
 * Values that aren't a string are shown as text-only — no broken visuals.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@/types/token'

const props = defineProps<{
  token: ResolvedToken
}>()

/**
 * "spacing" | "radius" — inferred from any path segment. The token's
 * `$type` is `dimension` for both; the visualisation difference (bar vs
 * rounded square) is derived from whether "radius" appears anywhere in the
 * dotted path, not just the first segment. This handles namespaced
 * conventions like `size.radius.md` or `border.radius.default`.
 */
const variant = computed<'spacing' | 'radius'>(() =>
  props.token.segments.some((s) => s === 'radius') ? 'radius' : 'spacing'
)

/** The resolved value as a string, for both the visual and the label. */
const valueString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : String(v)
})

/**
 * Whether the value is usable as a CSS length. CSS accepts unitless 0 and any
 * <number><unit> form — but rejects pure numbers and arbitrary strings.
 */
const isUsableLength = computed(() =>
  typeof props.token.resolvedValue === 'string' &&
  /^(?:0$|[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|%|in|cm|mm|pt|pc)$)/i.test(
    valueString.value
  )
)

/** Inline style binding for the visual element. */
const visualStyle = computed(() => {
  if (!isUsableLength.value) return {}
  if (variant.value === 'radius') {
    return { borderRadius: valueString.value }
  }
  // Spacing: the bar width IS the token value. Overflow protection lives in
  // CSS (max-width: 100% on .dtv-dimension__bar) — wrapping the value in
  // min(..., 100%) here defeats the visual: the 100% resolves against a
  // content-shrunk flex wrapper and collapses every bar to the same size.
  return { width: valueString.value }
})
</script>

<template>
  <div class="dtv-dimension">
    <div class="dtv-dimension__visual-wrap">
      <div
        v-if="variant === 'radius'"
        class="dtv-dimension__radius"
        :style="visualStyle"
        :aria-label="`Radius ${valueString}`"
        role="img"
      ></div>
      <div
        v-else
        class="dtv-dimension__bar"
        :style="visualStyle"
        :aria-label="`Spacing ${valueString}`"
        role="img"
      ></div>
    </div>
    <span class="dtv-dimension__value">{{ valueString }}</span>
  </div>
</template>

<style scoped>
.dtv-dimension {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
  align-items: flex-start;
}

/* width: 100% so the bar's max-width: 100% resolves against the card's
   content box (the card is the nearest positioned/width-defined ancestor),
   not a content-shrunk flex item. */
.dtv-dimension__visual-wrap {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
}

.dtv-dimension__bar {
  height: 16px;
  min-width: 2px;
  max-width: 100%;
  background-color: var(--dtv-color-accent);
  border-radius: var(--dtv-radius-sm);
}

.dtv-dimension__radius {
  width: 48px;
  height: 48px;
  background-color: var(--dtv-color-accent);
  /* borderRadius is applied via inline style from the token value. */
}

.dtv-dimension__value {
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text);
}
</style>
