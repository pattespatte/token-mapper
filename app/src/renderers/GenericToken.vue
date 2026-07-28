<script setup lang="ts">
/**
 * Generic fallback renderer.
 *
 * Used for any token whose `$type` doesn't have a dedicated renderer —
 * unknown types, future W3C types we haven't implemented yet, and tokens
 * with no `$type` at all. Renders the path-relevant metadata (type label +
 * raw value as JSON) so the user sees *something* useful rather than a
 * blank card.
 *
 * Never throws on any input shape: if the value can't be serialised we
 * fall back to String(value).
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** Pretty-printed value, with a graceful fallback for non-JSON values. */
const formattedValue = computed(() => {
  try {
    return JSON.stringify(props.token.resolvedValue, null, 2)
  } catch {
    return String(props.token.resolvedValue)
  }
})

/** Human-readable type label; "unknown" when no $type is present. */
const typeLabel = computed(() => props.token.type ?? 'unknown')
</script>

<template>
  <div class="dtm-generic">
    <span class="dtm-generic__type">{{ typeLabel }}</span>
    <pre class="dtm-generic__value"><code>{{ formattedValue }}</code></pre>
  </div>
</template>

<style scoped>
.dtm-generic {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
}

.dtm-generic__type {
  align-self: flex-start;
  font-size: var(--dtm-font-size-sm);
  font-family: var(--dtm-font-family-mono);
  color: var(--dtm-color-text-subtle);
  background-color: var(--dtm-color-surface-muted);
  padding: 2px var(--dtm-spacing-xs);
  border-radius: var(--dtm-radius-sm);
}

.dtm-generic__value {
  margin: 0;
  padding: var(--dtm-spacing-xs);
  background-color: var(--dtm-color-surface-muted);
  border-radius: var(--dtm-radius-sm);
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.dtm-generic__value code {
  font-family: inherit;
}
</style>
