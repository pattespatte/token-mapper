<script setup lang="ts">
/**
 * FontWeight renderer — for the W3C primitive `fontWeight` $type.
 *
 * Renders an "Aa" sample set in the resolved weight (100–900 / `normal` /
 * `bold` / `lighter` / `bolder`) so the stroke weight is visible at a glance,
 * plus the value as a label. For the absolute keywords `normal`/`bold`, a
 * normalised `≈ 400 (normal)` form is shown alongside — the browser maps
 * these to fixed numbers (normal→400, bold→700) per CSS Fonts L4. The
 * relative keywords `lighter`/`bolder` have no fixed number (they depend on
 * the inherited parent weight) so no normalised label is shown for them.
 *
 * Falls back to the page weight when the value isn't a usable string.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'
import { weightKeywordToNumber } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved weight as a string, when it is one. */
const weightString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : ''
})

/**
 * Normalised label for absolute keyword weights: `400 (normal)` / `700 (bold)`.
 * Empty for `lighter`/`bolder` (relative, no fixed number), for numeric weights
 * (the number is already shown), and for unparseable values — matching how
 * DurationSample hides its normalised label when the value can't be converted.
 */
const weightLabel = computed<string>(() => {
  const num = weightKeywordToNumber(weightString.value)
  if (num === null) return ''
  return `${num} (${weightString.value})`
})

/** Inline style applying the weight to the sample. */
const sampleStyle = computed(() => {
  if (weightString.value === '') return {}
  return { fontWeight: weightString.value }
})
</script>

<template>
  <div class="dtm-fontweight">
    <p
      class="dtm-fontweight__sample"
      :style="sampleStyle"
      role="img"
      :aria-label="`Sample at weight ${weightString || 'default'}`"
    >Aa Bb 123</p>
    <span class="dtm-fontweight__value">{{ weightString || '(not a string)' }}</span>
    <span v-if="weightLabel !== ''" class="dtm-fontweight__normalised">≈ {{ weightLabel }}</span>
  </div>
</template>

<style scoped>
.dtm-fontweight {
  display: flex;
  align-items: baseline;
  gap: var(--dtm-spacing-sm);
}

.dtm-fontweight__sample {
  margin: 0;
  font-size: var(--dtm-font-size-xl);
  line-height: 1.2;
  color: var(--dtm-color-text);
  /* fontWeight applied via inline style from the token value. */
}

.dtm-fontweight__value {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}

/* Normalised keyword label — mirrors DurationSample's __normalised styling. */
.dtm-fontweight__normalised {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}
</style>
