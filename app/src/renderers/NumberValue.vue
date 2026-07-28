<script setup lang="ts">
/**
 * Number renderer — for the W3C primitive `number` $type.
 *
 * Bare numerics (z-index, opacity ratios, flex-grow, line-height multipliers,
 * etc.) have no inherent visual; the renderer shows the value prominently in a
 * monospace face. This is a deliberate step up from the generic renderer
 * (which wraps the value in JSON.pretty) — the number reads as a number,
 * with the type implicit from the card context.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved number as a string. Numbers from JSON arrive as actual numbers;
 *  numbers from CSS arrive as strings. Normalise both to a display string. */
const valueString = computed(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  return '(not a number)'
})
</script>

<template>
  <div class="dtm-number">
    <span class="dtm-number__value">{{ valueString }}</span>
  </div>
</template>

<style scoped>
.dtm-number {
  display: flex;
  align-items: baseline;
}

.dtm-number__value {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-lg);
  color: var(--dtm-color-text);
}
</style>
