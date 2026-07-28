<script setup lang="ts">
/**
 * Duration renderer — for the W3C primitive `duration` $type.
 *
 * Durations (Nms / Ns) are abstract, so there's no faithful static visual.
 * The renderer shows the raw value prominently in a monospace face, plus a
 * normalised milliseconds equivalent so `0.3s` and `300ms` read as the same
 * duration at a glance. The sample-line animation is deliberately omitted:
 * a one-shot CSS animation can't re-trigger reliably in a card list and
 * would be distracting/motion-sensitive. The number is the signal.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The raw duration string, when it is one. */
const valueString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : ''
})

/**
 * The duration normalised to milliseconds, for a quick mental comparison
 * across `s` / `ms`. Returns '' when the value doesn't parse as a time.
 */
const asMillis = computed<string>(() => {
  const m = /^([+-]?\d+(?:\.\d+)?)\s*(ms|s)$/i.exec(valueString.value)
  if (m === null) return ''
  const n = parseFloat(m[1] ?? '')
  const unit = (m[2] ?? '').toLowerCase()
  if (Number.isNaN(n)) return ''
  const ms = unit === 's' ? n * 1000 : n
  // Trim to a clean representation (drop trailing .0 for integers).
  return Number.isInteger(ms) ? `${ms}ms` : `${ms.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}ms`
})
</script>

<template>
  <div class="dtm-duration">
    <span class="dtm-duration__value">{{ valueString || '(not a string)' }}</span>
    <span v-if="asMillis !== ''" class="dtm-duration__normalised">≈ {{ asMillis }}</span>
  </div>
</template>

<style scoped>
.dtm-duration {
  display: flex;
  align-items: baseline;
  gap: var(--dtm-spacing-sm);
}

.dtm-duration__value {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-lg);
  color: var(--dtm-color-text);
}

.dtm-duration__normalised {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}
</style>
