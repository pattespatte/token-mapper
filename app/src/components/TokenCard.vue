<script setup lang="ts">
/**
 * TokenCard — browse-mode card: one token's visual + path + copy.
 *
 * Wraps a TokenVisual (renderer dispatch) with a footer showing the dotted
 * path and copy-to-clipboard buttons:
 *   - copy path  (always shown) — copies the dotted path string
 *   - copy value (Tier 2 Should-Have) — copies the resolved value as
 *     JSON-pretty (composite types) or the literal primitive string
 *
 * Emits `select` with the path when activated (click / Enter / Space) so
 * the parent can open the Inspector.
 *
 * For compare mode, see DiffCard — it composes two TokenVisuals (or one +
 * a placeholder) plus a DiffBadge.
 */

import { computed, onUnmounted } from 'vue'
import type { ResolvedToken } from '@dtcg-mapper/core'
import { useClipboard } from '@/composables/useClipboard'
import TokenVisual from './TokenVisual.vue'

const props = defineProps<{
  token: ResolvedToken
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

// Two independent clipboard slots so each Copy button shows its own
// "Copied!" feedback without the other resetting.
const pathClipboard = useClipboard()
const valueClipboard = useClipboard()

async function copyPath(): Promise<void> {
  await pathClipboard.copy(props.token.path)
}

/**
 * Render the resolved value as a copy-friendly string: primitives as their
 * literal form (so `#6366f1` copies as `#6366f1`, not `"#6366f1"`), composite
 * types as pretty-printed JSON. Falls back to String(value) if JSON.stringify
 * throws (defensive against cyclic structures from malformed input).
 */
const valueForCopy = computed<string>(() => {
  const v = props.token.resolvedValue
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
})

async function copyValue(): Promise<void> {
  await valueClipboard.copy(valueForCopy.value)
}

onUnmounted(() => {
  pathClipboard.cleanup()
  valueClipboard.cleanup()
})
</script>

<template>
  <article
    class="dtm-card"
    tabindex="0"
    :aria-label="`Token ${token.path}`"
    @click="emit('select', token.path)"
    @keydown.enter.prevent="emit('select', token.path)"
    @keydown.space.prevent="emit('select', token.path)"
  >
    <TokenVisual :token="token" />
    <div class="dtm-card__footer">
      <code class="dtm-card__path" :title="token.path">{{ token.path }}</code>
      <div class="dtm-card__actions">
        <button
          type="button"
          class="dtm-card__copy"
          :aria-label="pathClipboard.copied.value ? 'Path copied' : `Copy path ${token.path}`"
          @click.stop="copyPath"
          @keydown.stop
        >
          {{ pathClipboard.copied.value ? '✓' : '⧉' }}
        </button>
        <button
          type="button"
          class="dtm-card__copy dtm-card__copy--value"
          :aria-label="valueClipboard.copied.value ? 'Value copied' : `Copy value of ${token.path}`"
          @click.stop="copyValue"
          @keydown.stop
        >{{ valueClipboard.copied.value ? '✓' : '⎘' }}</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.dtm-card {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
  padding: var(--dtm-spacing-md);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.dtm-card:hover,
.dtm-card:focus-visible {
  border-color: var(--dtm-color-accent);
  box-shadow: var(--dtm-shadow-card);
  outline: none;
}

.dtm-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dtm-spacing-xs);
}

.dtm-card__path {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-muted);
  word-break: break-all;
  line-height: 1.3;
}

.dtm-card__actions {
  display: inline-flex;
  gap: var(--dtm-spacing-xs);
  flex-shrink: 0;
}

.dtm-card__copy {
  padding: 2px var(--dtm-spacing-xs);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtm-card__copy:hover {
  color: var(--dtm-color-accent);
  border-color: var(--dtm-color-accent);
}
</style>

<style scoped>
.dtm-card {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
  padding: var(--dtm-spacing-md);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.dtm-card:hover,
.dtm-card:focus-visible {
  border-color: var(--dtm-color-accent);
  box-shadow: var(--dtm-shadow-card);
  outline: none;
}

.dtm-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dtm-spacing-xs);
}

.dtm-card__path {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-muted);
  word-break: break-all;
  line-height: 1.3;
}

.dtm-card__copy {
  flex-shrink: 0;
  padding: 2px var(--dtm-spacing-xs);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtm-card__copy:hover {
  color: var(--dtm-color-accent);
  border-color: var(--dtm-color-accent);
}
</style>
