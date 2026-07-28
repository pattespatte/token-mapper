<script setup lang="ts">
/**
 * FontFamily renderer — for the W3C primitive `fontFamily` $type.
 *
 * Renders an "Aa" sample set in the token's font family so the typeface is
 * visible at a glance, plus the raw stack (the comma-separated list of
 * families) in a spec list. The browser's own font resolution handles
 * fallbacks — if the first family isn't installed, it falls through to the
 * next, exactly as it would in real use.
 *
 * Falls back to the page font when the value isn't a usable string.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved font-family stack as a string, when it is one. */
const familyString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : ''
})

/** Inline style applying the font family to the sample. */
const sampleStyle = computed(() => {
  if (familyString.value === '') return {}
  return { fontFamily: familyString.value }
})
</script>

<template>
  <div class="dtm-fontfamily">
    <p
      class="dtm-fontfamily__sample"
      :style="sampleStyle"
      role="img"
      :aria-label="`Sample in ${familyString || 'the default font'}`"
    >Aa Bb 123</p>
    <p class="dtm-fontfamily__stack">{{ familyString || '(not a string)' }}</p>
  </div>
</template>

<style scoped>
.dtm-fontfamily {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
}

.dtm-fontfamily__sample {
  margin: 0;
  font-size: var(--dtm-font-size-xl);
  line-height: 1.2;
  color: var(--dtm-color-text);
  /* fontFamily applied via inline style from the token value. */
}

.dtm-fontfamily__stack {
  margin: 0;
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  word-break: break-all;
}
</style>
