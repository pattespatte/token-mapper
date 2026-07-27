<script setup lang="ts">
/**
 * Gradient renderer.
 *
 * Renders a gradient strip preview via the CSS `background` shorthand, plus
 * a parsed-stops list below.
 *
 * W3C DTCG draft shape (still in flux — handled defensively):
 *
 *   - Array of stops: `[{ color, position }, …]`. We treat this as a
 *     left-to-right linear gradient by default.
 *   - Wrapping object: `{ type, angle, stops }` where `type` is `'linear'`
 *     or `'radial'`, `angle` is an optional CSS angle, and `stops` is the
 *     array above.
 *
 * Falls back to a GenericToken-style JSON dump when the value isn't one of
 * these shapes.
 */

import { computed } from 'vue'
import type { RawValue, ResolvedToken } from '@dtcg-mapper/core'

const props = defineProps<{
  token: ResolvedToken
}>()

interface GradientStop {
  color?: RawValue
  position?: RawValue
}
/**
 * Raw input shape — kept loose (stops is `unknown` until filtered) so we
 * don't have to fight TypeScript's index-signature rules while inspecting
 * arbitrary user data.
 */
interface GradientShape {
  type?: RawValue
  angle?: RawValue
  stops?: unknown
}

/**
 * Normalise the resolved value into `{ type, angle, stops }`. Accepts:
 *   - bare array of stops (treated as linear)
 *   - object with `stops` array
 *   - object that IS a single stop (rare/defensive) — treated as one stop
 * Returns null when the shape isn't gradient-like.
 */
const parsed = computed<{ type: string; angle: string; stops: GradientStop[] } | null>(() => {
  const v = props.token.resolvedValue

  let shape: GradientShape
  if (Array.isArray(v)) {
    shape = { stops: v }
  } else if (typeof v === 'object' && v !== null) {
    // Could be a wrapping object or (defensively) a single stop.
    const obj = v as GradientShape & Record<string, unknown>
    if (Array.isArray(obj.stops)) {
      shape = obj
    } else if ('color' in obj || 'position' in obj) {
      shape = { stops: [obj as unknown] }
    } else {
      return null
    }
  } else {
    return null
  }

  const rawStops = Array.isArray(shape.stops) ? shape.stops : []
  const stops: GradientStop[] = rawStops.filter(
    (s): s is Record<string, RawValue> => typeof s === 'object' && s !== null
  ) as unknown as GradientStop[]
  if (stops.length === 0) return null

  const typeStr = typeof shape.type === 'string' ? shape.type.toLowerCase() : 'linear'
  const gradientType = typeStr === 'radial' ? 'radial' : 'linear'
  const angle = typeof shape.angle === 'string' ? shape.angle : '90deg'

  return { type: gradientType, angle, stops }
})

const isRenderable = computed(() => parsed.value !== null)

/**
 * CSS `background` value for the strip. For linear: `linear-gradient(<angle>, <stops>)`.
 * For radial: `radial-gradient(circle, <stops>)`. Stops are joined as
 * `<color> <position>` pairs (position optional).
 */
const backgroundCss = computed<string>(() => {
  const p = parsed.value
  if (p === null) return ''
  const stopsCss = p.stops
    .map((s) => {
      const color = typeof s.color === 'string' ? s.color : 'currentColor'
      const position = typeof s.position === 'string' || typeof s.position === 'number'
        ? ` ${s.position}`
        : ''
      return `${color}${position}`
    })
    .join(', ')
  if (p.type === 'radial') return `radial-gradient(circle, ${stopsCss})`
  return `linear-gradient(${p.angle}, ${stopsCss})`
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
</script>

<template>
  <div class="dtv-gradient">
    <template v-if="isRenderable">
      <div
        class="dtv-gradient__strip"
        :style="{ background: backgroundCss }"
        :aria-label="`Gradient preview for ${token.path}`"
        role="img"
      ></div>
      <ul class="dtv-gradient__stops">
        <li v-for="(stop, idx) in parsed?.stops ?? []" :key="idx" class="dtv-gradient__stop">
          <span class="dtv-gradient__stop-label">Stop {{ idx + 1 }}</span>
          <dl class="dtv-gradient__fields">
            <div class="dtv-gradient__field"><dt>color</dt><dd>{{ fieldText(stop.color) }}</dd></div>
            <div class="dtv-gradient__field"><dt>position</dt><dd>{{ fieldText(stop.position) }}</dd></div>
          </dl>
        </li>
      </ul>
    </template>
    <pre v-else class="dtv-gradient__fallback"><code>{{ jsonDump }}</code></pre>
  </div>
</template>

<style scoped>
.dtv-gradient {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
}

.dtv-gradient__strip {
  width: 100%;
  height: 56px;
  border-radius: var(--dtv-radius-md);
  border: 1px solid var(--dtv-color-border);
  /* background is applied via inline style from the token value. */
}

.dtv-gradient__stops {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
}

.dtv-gradient__stop {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
}

.dtv-gradient__stop-label {
  font-family: var(--dtv-font-family-mono);
  color: var(--dtv-color-text-subtle);
}

.dtv-gradient__fields {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 2px var(--dtv-spacing-sm);
}

.dtv-gradient__field {
  display: flex;
  gap: var(--dtv-spacing-xs);
}

.dtv-gradient__field dt {
  color: var(--dtv-color-text-subtle);
  font-family: var(--dtv-font-family-mono);
  flex-shrink: 0;
}

.dtv-gradient__field dd {
  margin: 0;
  color: var(--dtv-color-text);
  font-family: var(--dtv-font-family-mono);
  word-break: break-all;
}

.dtv-gradient__fallback {
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
