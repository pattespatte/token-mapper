<script setup lang="ts">
/**
 * FontWeight renderer — for the W3C primitive `fontWeight` $type.
 *
 * Renders an "Aa" sample set in the resolved weight (100–900 / `normal` /
 * `bold` / `lighter` / `bolder`) so the stroke weight is visible at a glance,
 * plus the numeric/keyword value as a label. The browser maps the keyword
 * forms to their numeric equivalents (normal→400, bold→700) automatically.
 *
 * Falls back to the page weight when the value isn't a usable string.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved weight as a string, when it is one. */
const weightString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : ''
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
</style>
