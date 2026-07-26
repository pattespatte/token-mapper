<script setup lang="ts">
/**
 * Border renderer.
 *
 * Renders a rectangle with the resolved border applied via the CSS `border`
 * shorthand, plus a parsed-fields list (width / style / color). W3C DTCG
 * border shape:
 *
 *   { width, style, color }
 *
 * `width` is a dimension (CSS length), `style` is a CSS line-style keyword
 * (`solid`, `dashed`, …), `color` is a CSS color.
 *
 * Defensive on partial input — the validator only checks that the value is
 * an object, so individual fields may be absent or wrong-typed. Missing
 * fields fall back to visible CSS defaults (`medium`/`solid`/`currentColor`)
 * so the preview is always visible. A non-object value falls back to a
 * GenericToken-style JSON dump.
 */

import { computed } from 'vue'
import type { RawValue, ResolvedToken } from '@/types/token'

const props = defineProps<{
  token: ResolvedToken
}>()

interface BorderValue {
  width?: RawValue
  style?: RawValue
  color?: RawValue
}

/** Coerce the resolved value into the expected object shape, or null. */
const border = computed<BorderValue | null>(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as BorderValue
  }
  return null
})

const isRenderable = computed(() => border.value !== null)

/**
 * CSS `border` shorthand for the inline style. Falls back to visible
 * defaults when fields are missing so the preview rectangle is always
 * discernible (a 0-width border would be invisible otherwise).
 */
const borderCss = computed<string>(() => {
  const b = border.value
  if (b === null) return ''
  const width = asString(b.width) ?? 'medium'
  const style = asString(b.style) ?? 'solid'
  const color = typeof b.color === 'string' ? b.color : 'currentColor'
  return `${width} ${style} ${color}`
})

const jsonDump = computed(() => {
  try {
    return JSON.stringify(props.token.resolvedValue, null, 2)
  } catch {
    return String(props.token.resolvedValue)
  }
})

/** Pretty-print one field, or "—" when absent. */
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

/** Coerce to string when the value is string-like; otherwise undefined. */
function asString(v: RawValue | undefined): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}
</script>

<template>
  <div class="dtv-border">
    <template v-if="isRenderable">
      <div
        class="dtv-border__preview"
        :style="{ border: borderCss }"
        :aria-label="`Border preview for ${token.path}`"
        role="img"
      ></div>
      <dl class="dtv-border__fields">
        <div class="dtv-border__field"><dt>width</dt><dd>{{ fieldText(border?.width) }}</dd></div>
        <div class="dtv-border__field"><dt>style</dt><dd>{{ fieldText(border?.style) }}</dd></div>
        <div class="dtv-border__field"><dt>color</dt><dd>{{ fieldText(border?.color) }}</dd></div>
      </dl>
    </template>
    <pre v-else class="dtv-border__fallback"><code>{{ jsonDump }}</code></pre>
  </div>
</template>

<style scoped>
.dtv-border {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
}

.dtv-border__preview {
  width: 100%;
  height: 64px;
  background-color: var(--dtv-color-bg);
  border-radius: var(--dtv-radius-md);
  /* border is applied via inline style from the token value. */
}

.dtv-border__fields {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 2px var(--dtv-spacing-sm);
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
}

.dtv-border__field {
  display: flex;
  gap: var(--dtv-spacing-xs);
}

.dtv-border__field dt {
  color: var(--dtv-color-text-subtle);
  font-family: var(--dtv-font-family-mono);
  flex-shrink: 0;
}

.dtv-border__field dd {
  margin: 0;
  color: var(--dtv-color-text);
  font-family: var(--dtv-font-family-mono);
  word-break: break-all;
}

.dtv-border__fallback {
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
