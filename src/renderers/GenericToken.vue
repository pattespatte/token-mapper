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
import type { ResolvedToken } from '@/types/token'

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
  <div class="dtv-generic">
    <span class="dtv-generic__type">{{ typeLabel }}</span>
    <pre class="dtv-generic__value"><code>{{ formattedValue }}</code></pre>
  </div>
</template>

<style scoped>
.dtv-generic {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
}

.dtv-generic__type {
  align-self: flex-start;
  font-size: var(--dtv-font-size-sm);
  font-family: var(--dtv-font-family-mono);
  color: var(--dtv-color-text-subtle);
  background-color: var(--dtv-color-surface-muted);
  padding: 2px var(--dtv-spacing-xs);
  border-radius: var(--dtv-radius-sm);
}

.dtv-generic__value {
  margin: 0;
  padding: var(--dtv-spacing-xs);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.dtv-generic__value code {
  font-family: inherit;
}
</style>
