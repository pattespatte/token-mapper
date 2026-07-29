<script setup lang="ts">
/**
 * FontFamily renderer — for the W3C primitive `fontFamily` $type.
 *
 * Renders an "Aa" sample set in the token's font family so the typeface is
 * visible at a glance, plus a spec list with the primary family name (the
 * first comma-separated entry, quotes stripped — the name a designer
 * recognises) and the full raw stack. The browser's own font resolution
 * handles fallbacks — if the first family isn't installed, it falls through
 * to the next, exactly as it would in real use.
 *
 * Falls back to the page font when the value isn't a usable string.
 */

import { computed } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'
import { primaryFontFamily } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved font-family stack as a string, when it is one. */
const familyString = computed(() => {
  const v = props.token.resolvedValue
  return typeof v === 'string' ? v : ''
})

/** The primary family name extracted from the stack (first entry, unquoted). */
const primaryFamily = computed(() => primaryFontFamily(familyString.value))

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
      :aria-label="`Sample in ${primaryFamily || 'the default font'}`"
    >Aa Bb 123</p>
    <dl class="dtm-fontfamily__spec">
      <div v-if="primaryFamily !== ''" class="dtm-fontfamily__row">
        <dt>primary</dt>
        <dd>{{ primaryFamily }}</dd>
      </div>
      <div class="dtm-fontfamily__row">
        <dt>stack</dt>
        <dd>{{ familyString || '(not a string)' }}</dd>
      </div>
    </dl>
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

/* Spec list mirrors ColorSwatch's dl/dt/dd pattern. */
.dtm-fontfamily__spec {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--dtm-spacing-sm);
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
}

.dtm-fontfamily__row {
  display: contents;
}

.dtm-fontfamily__row dt {
  color: var(--dtm-color-text-subtle);
}

.dtm-fontfamily__row dd {
  margin: 0;
  color: var(--dtm-color-text);
  word-break: break-all;
}
</style>
