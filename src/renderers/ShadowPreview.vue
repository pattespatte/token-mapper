<script setup lang="ts">
/**
 * Shadow renderer.
 *
 * Renders a sample card with the resolved shadow applied as `box-shadow`,
 * plus a parsed-layers list below. Supports:
 *   - single-layer shadow: `{ offsetX, offsetY, blur, spread?, color, inset? }`
 *   - multi-layer shadow: an array of the above (composited top-to-bottom)
 *
 * Defensive on partial input — the W3C DTCG shadow spec is still a draft and
 * Tokens Studio exports vary. Missing fields fall back to CSS defaults
 * (`0` for lengths, `currentColor` for colour) and the parsed-layers list
 * shows "—" for absent fields rather than omitting them. A value that isn't
 * an object or array (e.g. a literal string a user typed) falls back to the
 * GenericToken-style JSON dump.
 */

import { computed } from 'vue'
import type { RawValue, ResolvedToken } from '@/types/token'

const props = defineProps<{
  token: ResolvedToken
}>()

/** Per-layer shape expected by the W3C DTCG draft. */
interface ShadowLayer {
  offsetX?: RawValue
  offsetY?: RawValue
  blur?: RawValue
  spread?: RawValue
  color?: RawValue
  inset?: RawValue
}

/**
 * Normalise the resolved value into a list of layers. Single object → one
 * layer; array → many; anything else → empty (caller falls back to JSON dump).
 */
const layers = computed<ShadowLayer[]>(() => {
  const v = props.token.resolvedValue
  if (Array.isArray(v)) {
    return v.filter(
      (item): item is Record<string, RawValue> =>
        typeof item === 'object' && item !== null
    ) as unknown as ShadowLayer[]
  }
  if (typeof v === 'object' && v !== null) {
    return [v as unknown as ShadowLayer]
  }
  return []
})

/** True when the value is a renderable object/array shape. */
const isRenderable = computed(() => layers.value.length > 0)

/**
 * CSS box-shadow string composited from every layer, in spec order. CSS
 * expects comma-separated layers; inset (when present) prefixes its layer.
 */
const boxShadowCss = computed<string>(() => {
  return layers.value
    .map((layer) => {
      const parts: string[] = []
      if (layer.inset === true || layer.inset === 'true') parts.push('inset')
      if (isLength(layer.offsetX)) parts.push(String(layer.offsetX))
      else parts.push('0')
      if (isLength(layer.offsetY)) parts.push(String(layer.offsetY))
      else parts.push('0')
      // blur and spread are optional; include only when present.
      if (isLength(layer.blur)) parts.push(String(layer.blur))
      if (isLength(layer.spread)) parts.push(String(layer.spread))
      if (typeof layer.color === 'string') parts.push(layer.color)
      else parts.push('currentColor')
      return parts.join(' ')
    })
    .join(', ')
})

/** Fallback JSON dump for non-object values. */
const jsonDump = computed(() => {
  try {
    return JSON.stringify(props.token.resolvedValue, null, 2)
  } catch {
    return String(props.token.resolvedValue)
  }
})

/** Pretty-print one field of a layer, or "—" when absent. */
function fieldText(value: RawValue | undefined): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** True when v is a usable CSS-length-ish string (or number 0). */
function isLength(v: RawValue | undefined): v is string | number {
  if (v === undefined) return false
  if (typeof v === 'number') return true
  if (typeof v === 'string') return /^[-+]?\d*\.?\d+(?:px|rem|em|ex|ch|vw|vh|%|in|cm|mm|pt|pc)?$/i.test(v)
  return false
}
</script>

<template>
  <div class="dtv-shadow">
    <template v-if="isRenderable">
      <div
        class="dtv-shadow__preview"
        :style="{ boxShadow: boxShadowCss }"
        :aria-label="`Shadow preview for ${token.path}`"
        role="img"
      ></div>
      <ul class="dtv-shadow__layers">
        <li v-for="(layer, idx) in layers" :key="idx" class="dtv-shadow__layer">
          <span class="dtv-shadow__layer-label">
            {{ layers.length > 1 ? `Layer ${idx + 1}` : 'Layer' }}
            <span v-if="layer.inset === true || layer.inset === 'true'" class="dtv-shadow__inset">(inset)</span>
          </span>
          <dl class="dtv-shadow__fields">
            <div class="dtv-shadow__field"><dt>offsetX</dt><dd>{{ fieldText(layer.offsetX) }}</dd></div>
            <div class="dtv-shadow__field"><dt>offsetY</dt><dd>{{ fieldText(layer.offsetY) }}</dd></div>
            <div class="dtv-shadow__field"><dt>blur</dt><dd>{{ fieldText(layer.blur) }}</dd></div>
            <div class="dtv-shadow__field"><dt>spread</dt><dd>{{ fieldText(layer.spread) }}</dd></div>
            <div class="dtv-shadow__field"><dt>color</dt><dd>{{ fieldText(layer.color) }}</dd></div>
          </dl>
        </li>
      </ul>
    </template>
    <pre v-else class="dtv-shadow__fallback"><code>{{ jsonDump }}</code></pre>
  </div>
</template>

<style scoped>
.dtv-shadow {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
}

.dtv-shadow__preview {
  width: 100%;
  height: 64px;
  background-color: var(--dtv-color-bg);
  border-radius: var(--dtv-radius-md);
  /* boxShadow is applied via inline style from the token value. */
}

.dtv-shadow__layers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
}

.dtv-shadow__layer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
}

.dtv-shadow__layer-label {
  font-family: var(--dtv-font-family-mono);
  color: var(--dtv-color-text-subtle);
}

.dtv-shadow__inset {
  color: var(--dtv-color-text-muted);
  font-style: italic;
}

.dtv-shadow__fields {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 2px var(--dtv-spacing-sm);
}

.dtv-shadow__field {
  display: flex;
  gap: var(--dtv-spacing-xs);
}

.dtv-shadow__field dt {
  color: var(--dtv-color-text-subtle);
  font-family: var(--dtv-font-family-mono);
  flex-shrink: 0;
}

.dtv-shadow__field dd {
  margin: 0;
  color: var(--dtv-color-text);
  font-family: var(--dtv-font-family-mono);
  word-break: break-all;
}

.dtv-shadow__fallback {
  margin: 0;
  padding: var(--dtv-spacing-xs);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
