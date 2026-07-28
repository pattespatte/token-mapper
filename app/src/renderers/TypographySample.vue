<script setup lang="ts">
/**
 * Typography renderer — for the W3C composite `typography` $type.
 *
 * The $value is an object with optional fields: fontFamily, fontSize,
 * fontWeight, fontWidth (stretch), lineHeight, letterSpacing, paragraphSpacing,
 * textDecorationCase, etc. We render a sample line ("The quick brown fox…")
 * styled with every provided field, plus a small spec list of the values.
 *
 * Sub-field values may themselves be aliases — the resolver already inlined
 * them into `resolvedValue`, so we read from there (not rawValue).
 */

import { computed } from 'vue'
import type { RawValue, ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

/** The resolved typography composite, or null if the value isn't an object. */
const composite = computed<Record<string, RawValue> | null>(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as Record<string, RawValue>
  }
  return null
})

/**
 * CSS style object derived from the composite. Only fields present and
 * string/number-valued contribute — absent fields inherit from the page so
 * the sample still renders readably.
 */
const sampleStyle = computed<Record<string, string>>(() => {
  const c = composite.value
  if (c === null) return {}
  const style: Record<string, string> = {}

  const fontFamily = c.fontFamily
  if (typeof fontFamily === 'string') style.fontFamily = fontFamily

  const fontSize = c.fontSize
  if (typeof fontSize === 'string') style.fontSize = fontSize

  const fontWeight = c.fontWeight
  if (typeof fontWeight === 'string' || typeof fontWeight === 'number') {
    style.fontWeight = String(fontWeight)
  }

  const lineHeight = c.lineHeight
  if (typeof lineHeight === 'string' || typeof lineHeight === 'number') {
    style.lineHeight = String(lineHeight)
  }

  const letterSpacing = c.letterSpacing
  if (typeof letterSpacing === 'string') style.letterSpacing = letterSpacing

  return style
})

/**
 * Spec rows for the value list. Shows each provided field so a designer can
 * read the typography token at a glance.
 */
type SpecRow = { label: string; value: string }

const SPEC_LABELS: Record<string, string> = {
  fontFamily: 'Family',
  fontSize: 'Size',
  fontWeight: 'Weight',
  lineHeight: 'Line height',
  letterSpacing: 'Tracking',
  fontWidth: 'Width',
  paragraphSpacing: 'Para spacing',
}

const specRows = computed<SpecRow[]>(() => {
  const c = composite.value
  if (c === null) return []
  const rows: SpecRow[] = []
  for (const key of Object.keys(c)) {
    const label = SPEC_LABELS[key] ?? key
    const v = c[key]
    if (v === undefined) continue
    rows.push({ label, value: typeof v === 'string' ? v : JSON.stringify(v) })
  }
  return rows
})
</script>

<template>
  <div class="dtm-typography">
    <p
      v-if="composite"
      class="dtm-typography__sample"
      :style="sampleStyle"
    >The quick brown fox jumps over the lazy dog</p>
    <p v-else class="dtm-typography__broken">
      Typography value is not a composite object.
    </p>

    <dl class="dtm-typography__spec">
      <div v-for="row in specRows" :key="row.label" class="dtm-typography__row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.dtm-typography {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
}

.dtm-typography__sample {
  margin: 0;
  /* Defaults inherited from the page; per-token fields applied via inline style. */
  color: var(--dtm-color-text);
  /* Leave font-family unset when the token doesn't specify one — fall through. */
  word-break: break-word;
}

.dtm-typography__broken {
  margin: 0;
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  font-style: italic;
}

.dtm-typography__spec {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--dtm-spacing-sm);
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
}

.dtm-typography__row {
  display: contents;
}

.dtm-typography__row dt {
  color: var(--dtm-color-text-subtle);
}

.dtm-typography__row dd {
  margin: 0;
  color: var(--dtm-color-text);
  word-break: break-all;
}
</style>
