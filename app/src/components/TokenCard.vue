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
 * Validation indicator: when `issues` is non-empty the card grows a coloured
 * left stripe and a severity icon button in the actions row. Clicking the
 * icon emits `jump-to-validation`, which the parent (Gallery) turns into
 * "open the set's validation panel and scroll to it". This makes value-shape
 * problems (e.g. a `dimension` value stored as a bare number) discoverable
 * right at the affected card instead of only in the bottom panel.
 *
 * For compare mode, see DiffCard — it composes two TokenVisuals (or one +
 * a placeholder) plus a DiffBadge.
 */

import { computed, onUnmounted } from 'vue'
import type { ResolvedToken, ValidationIssue } from '@dtcg-mapper/core'
import { useClipboard } from '@/composables/useClipboard'
import TokenVisual from './TokenVisual.vue'

const props = withDefaults(
  defineProps<{
    token: ResolvedToken
    /**
     * Validation issues targeting this token's path, if any. Passed down from
     * the gallery's per-path issue map. Defaults to empty (no indicator).
     */
    issues?: ValidationIssue[]
  }>(),
  { issues: () => [] }
)

const emit = defineEmits<{
  select: [path: string]
  /** Fired when the card's issue indicator is clicked — open validation panel. */
  'jump-to-validation': []
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

/** True when at least one validation issue targets this token. */
const hasIssue = computed(() => props.issues.length > 0)

/**
 * Highest-severity level across the card's issues — errors win over warnings.
 * Drives both the stripe colour and the icon glyph. Only consulted when
 * {@link hasIssue} is true.
 */
const highestSeverity = computed<'error' | 'warning'>(() =>
  props.issues.some((i) => i.severity === 'error') ? 'error' : 'warning'
)

/**
 * Tooltip text for the indicator button: every issue message on its own line,
 * prefixed with the severity glyph (mirrors the validation panel's rows).
 * Capped at a handful of messages so the tooltip stays readable when a token
 * triggers many checks.
 */
const issueTitle = computed(() => {
  const messages = props.issues.slice(0, 5).map((i) => {
    const glyph = i.severity === 'error' ? '⛔' : '⚠'
    return `${glyph} ${i.message}`
  })
  const more = props.issues.length - messages.length
  if (more > 0) messages.push(`…and ${more} more`)
  return messages.join('\n')
})

onUnmounted(() => {
  pathClipboard.cleanup()
  valueClipboard.cleanup()
})
</script>

<template>
  <article
    class="dtm-card"
    :class="{
      'dtm-card--has-issue': hasIssue,
      [`dtm-card--has-${highestSeverity}`]: hasIssue,
    }"
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
          v-if="hasIssue"
          type="button"
          class="dtm-card__indicator"
          :class="`dtm-card__indicator--${highestSeverity}`"
          :title="issueTitle"
          aria-label="Open validation details for this token"
          @click.stop="emit('jump-to-validation')"
          @keydown.stop
        >{{ highestSeverity === 'error' ? '⛔' : '⚠' }}</button>
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

/*
 * Validation indicator — coloured left stripe signalling that this token has
 * at least one validation issue. Colour follows the highest severity, matching
 * the validation panel's error/warning hues. The stripe sits on the border so
 * it reads at a glance without crowding the visual or footer. Mirrors the
 * existing left-stripe precedent in DiffInspector (`border-left: 3px solid`).
 */
.dtm-card--has-warning {
  border-left: 3px solid var(--dtm-color-warning);
}

.dtm-card--has-error {
  border-left: 3px solid var(--dtm-color-error);
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

/*
 * Severity indicator button — same shape as the copy buttons so it sits in the
 * actions row without visual noise; colour carries the severity. White-space
 * `pre-line` lets the multi-line `title` tooltip render naturally. The glyph
 * matches the validation panel's (⚠ / ⛔).
 */
.dtm-card__indicator {
  flex-shrink: 0;
  padding: 2px var(--dtm-spacing-xs);
  font-size: var(--dtm-font-size-sm);
  line-height: 1;
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
}

.dtm-card__indicator--warning {
  color: var(--dtm-color-warning);
  border-color: var(--dtm-color-warning);
}

.dtm-card__indicator--error {
  color: var(--dtm-color-error);
  border-color: var(--dtm-color-error);
}

.dtm-card__indicator:hover {
  box-shadow: var(--dtm-shadow-card);
}
</style>
