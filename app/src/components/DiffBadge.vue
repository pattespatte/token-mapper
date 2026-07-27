<script setup lang="ts">
/**
 * DiffBadge — small coloured pill indicating a token's diff bucket.
 *
 * Used in compare mode on each DiffCard. Bucket labels are written from set
 * A's perspective ("missing" = missing from B), matching the documented
 * framing.
 *
 * Colours meet WCAG AA contrast against the card background. Each variant
 * also carries an aria-label so screen readers announce the bucket meaning
 * rather than the short visible text.
 */

import { computed } from 'vue'
import type { DiffBucket } from '@dtcg-mapper/core'

const props = defineProps<{
  bucket: DiffBucket
}>()

const VARIANT: Record<DiffBucket, { label: string; aria: string }> = {
  matching: { label: 'Match', aria: 'matching — same value in both sets' },
  changed: { label: 'Changed', aria: 'changed — different values between sets' },
  missing: { label: 'Missing in B', aria: 'missing — present in set A only' },
  extra: { label: 'Extra in B', aria: 'extra — present in set B only' },
}

const variant = computed(() => VARIANT[props.bucket])
</script>

<template>
  <span
    class="dtv-diff-badge"
    :class="`dtv-diff-badge--${bucket}`"
    :aria-label="variant.aria"
  >
    {{ variant.label }}
  </span>
</template>

<style scoped>
.dtv-diff-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--dtv-spacing-sm);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
  line-height: 1.3;
  white-space: nowrap;
}

/*
 * Each variant picks foreground/background colours that hit WCAG AA against
 * the card surface. Tested against both light and dark themes' surfaces.
 */
.dtv-diff-badge--matching {
  background-color: var(--dtv-color-success);
  color: #ffffff;
}

.dtv-diff-badge--changed {
  background-color: var(--dtv-color-warning);
  color: #ffffff;
}

.dtv-diff-badge--missing {
  background-color: var(--dtv-color-error);
  color: #ffffff;
}

.dtv-diff-badge--extra {
  background-color: var(--dtv-color-info);
  color: #ffffff;
}
</style>
