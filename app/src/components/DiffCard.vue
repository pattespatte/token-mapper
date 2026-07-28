<script setup lang="ts">
/**
 * DiffCard — compare-mode card for one token path.
 *
 * Shows the diff bucket (via DiffBadge), the dotted path, and one or two
 * TokenVisuals depending on the bucket:
 *   - matching / changed: render both set A and set B side-by-side. For
 *     `changed`, a small arrow between them hints at the delta.
 *   - missing (in A only): show A on the left; right column is a placeholder
 *     "not in set B".
 *   - extra (in B only): show B on the right; left column is a placeholder
 *     "not in set A".
 *
 * The two-column layout only applies when both sides are renderable; for
 * missing/extra we still keep the two-column grid for visual alignment so
 * the gallery doesn't jump around as the filter changes.
 *
 * Clicking the card (or focusing it and pressing Enter/Space) emits `select`
 * with the token path, opening the A/B DiffInspector. The copy button inside
 * the header stops propagation so clicking copy doesn't also open the
 * inspector — that would be annoying.
 */

import { onUnmounted } from 'vue'
import type { TokenDiff } from '@dtcg-mapper/core'
import { useClipboard } from '@/composables/useClipboard'
import DiffBadge from './DiffBadge.vue'
import TokenVisual from './TokenVisual.vue'

const props = defineProps<{
  diff: TokenDiff
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
}>()

const { copied, copy: copyToClipboard, cleanup: cleanupClipboard } = useClipboard()

async function copyPath(): Promise<void> {
  await copyToClipboard(props.diff.path)
}

/** Card click handler — opens the DiffInspector for this token. */
function onSelect(): void {
  emit('select', props.diff.path)
}

/**
 * Keyboard activation for the card-as-button. Browsers fire `click` on
 * native buttons for Enter/Space already, but the `<article role="button">`
 * pattern needs explicit handling.
 */
function onCardKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSelect()
  }
}

onUnmounted(() => {
  cleanupClipboard()
})
</script>

<template>
  <article
    class="dtm-diffcard"
    :class="`dtm-diffcard--${diff.bucket}`"
    :aria-label="`Token ${diff.path}, ${diff.bucket}. Activate to open inspector.`"
    role="button"
    tabindex="0"
    @click="onSelect"
    @keydown="onCardKeydown"
  >
    <header class="dtm-diffcard__header">
      <code class="dtm-diffcard__path" :title="diff.path">{{ diff.path }}</code>
      <!-- Arrow hint shown only for changed tokens; lives in the header so it
           doesn't steal a body grid column from the side-by-side visuals. -->
      <span
        v-if="diff.bucket === 'changed'"
        class="dtm-diffcard__arrow"
        aria-hidden="true"
        >→</span
      >
      <!-- One-line delta summary from the explainer (Tier 2). Compact chip
           rendered only for `changed` tokens with an explanation. -->
      <span
        v-if="diff.bucket === 'changed' && diff.explanation"
        class="dtm-diffcard__delta"
        :title="`What changed: ${diff.explanation.summary}`"
      >{{ diff.explanation.summary }}</span>
      <DiffBadge :bucket="diff.bucket" />
      <button
        type="button"
        class="dtm-diffcard__copy"
        :aria-label="copied ? 'Path copied' : `Copy ${diff.path}`"
        @click.stop="copyPath"
      >
        {{ copied ? '✓' : '⧉' }}
      </button>
    </header>

    <div class="dtm-diffcard__body" :class="`dtm-diffcard__body--${diff.bucket}`">
      <!-- Set A column -->
      <div class="dtm-diffcard__side dtm-diffcard__side--a">
        <span class="dtm-diffcard__sidelabel">A</span>
        <TokenVisual v-if="diff.a" :token="diff.a" />
        <p v-else class="dtm-diffcard__absent">not in set A</p>
      </div>

      <!-- Set B column -->
      <div class="dtm-diffcard__side dtm-diffcard__side--b">
        <span class="dtm-diffcard__sidelabel">B</span>
        <TokenVisual v-if="diff.b" :token="diff.b" />
        <p v-else class="dtm-diffcard__absent">not in set B</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.dtm-diffcard {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
  padding: var(--dtm-spacing-md);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
  border-left: 3px solid var(--dtm-color-border-strong);
  /* Card-as-button affordance: cursor + focus ring. */
  cursor: pointer;
}

.dtm-diffcard:hover {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1). */
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-diffcard:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: 2px;
}

.dtm-diffcard--selected {
  border-color: var(--dtm-color-accent);
  box-shadow: 0 0 0 2px var(--dtm-color-accent);
}

/*
 * Coloured left border per bucket — at-a-glance scanning without the badge.
 * Matches DiffBadge colours.
 */
.dtm-diffcard--matching {
  border-left-color: var(--dtm-color-success);
}

.dtm-diffcard--changed {
  border-left-color: var(--dtm-color-warning);
}

.dtm-diffcard--missing {
  border-left-color: var(--dtm-color-error);
}

.dtm-diffcard--extra {
  border-left-color: var(--dtm-color-info);
}

.dtm-diffcard__header {
  display: flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
}

.dtm-diffcard__path {
  flex: 1;
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-muted);
  word-break: break-all;
  line-height: 1.3;
}

.dtm-diffcard__copy {
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

.dtm-diffcard__copy:hover {
  color: var(--dtm-color-accent);
  border-color: var(--dtm-color-accent);
}

.dtm-diffcard__body {
  display: grid;
  gap: var(--dtm-spacing-sm);
  /*
   * stretch (the default) so both sides end up the same height: a swatch
   * card and a "not in set X" placeholder align row-for-row, and the
   * shorter side's absent block grows to match the taller side.
   */
  align-items: stretch;
}

/*
 * Track layout is bucket-aware: the present side gets the wide track, the
 * absent side (or equal peer) gets the rest. Sides stay in DOM order —
 * reordering via grid-column broke auto-placement and stacked the sides
 * onto separate rows.
 *
 *   matching : both present, equal  -> minmax(0,1fr) minmax(0,1fr)
 *   missing  : A present, B absent  -> minmax(0,1fr) auto
 *   extra    : A absent,  B present -> auto minmax(0,1fr)
 *   changed  : both present, equal  -> minmax(0,1fr) minmax(0,1fr)
 *   (the changed arrow now lives in the header, not a body column)
 *
 * minmax(0,1fr) (instead of bare 1fr) prevents the track from blowing out
 * when a side's min-content (e.g. a wide swatch) exceeds its share.
 */
.dtm-diffcard__body--matching,
.dtm-diffcard__body--changed {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.dtm-diffcard__body--missing {
  grid-template-columns: minmax(0, 1fr) auto;
}

.dtm-diffcard__body--extra {
  grid-template-columns: auto minmax(0, 1fr);
}

/*
 * Each side is a row: the A/B label sits inline on the left and the visual
 * (or absent placeholder) fills the rest, vertically centered. This keeps
 * the label on the same baseline as the content's top region and lets the
 * content area stretch to the side's full height.
 */
.dtm-diffcard__side {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: var(--dtm-spacing-sm);
  min-width: 0;
}

/*
 * The A/B label is a small pill so the side anchor is unmistakable. Kept
 * neutral (not coloured per side) so it doesn't fight the bucket-coloured
 * left border / DiffBadge; the letter itself carries the A-vs-B meaning.
 */
.dtm-diffcard__sidelabel {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;
  padding: 2px var(--dtm-spacing-xs);
  border-radius: var(--dtm-radius-sm);
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
  border: 1px solid var(--dtm-color-border);
  font-family: var(--dtm-font-family-mono);
  line-height: 1.3;
}

/*
 * The visual/absent wrapper fills the side's remaining width and full
 * height so an inner block can grow to match the opposite side.
 */
.dtm-diffcard__side > :not(.dtm-diffcard__sidelabel) {
  flex: 1 1 auto;
  min-width: 0;
}

.dtm-diffcard__absent {
  margin: 0;
  padding: var(--dtm-spacing-md);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  font-style: italic;
  background-color: var(--dtm-color-surface-muted);
  border-radius: var(--dtm-radius-md);
  text-align: center;
  /*
   * min-height keeps a lonely absent side readable; the flex-grow above lets
   * it stretch to match a taller sibling when paired with a real visual.
   */
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * Vertical divider between the two sides. Side B sits directly after side A
 * in the same row for every bucket, so a border on B's inline-start edge is
 * the divider. (The `changed` arrow used to live in a middle body column and
 * carried the divider there; it has moved to the header, so `changed` now
 * shares side B's divider treatment.)
 */
.dtm-diffcard__body--matching .dtm-diffcard__side--b,
.dtm-diffcard__body--missing .dtm-diffcard__side--b,
.dtm-diffcard__body--extra .dtm-diffcard__side--b,
.dtm-diffcard__body--changed .dtm-diffcard__side--b {
  border-inline-start: 1px solid var(--dtm-color-border);
  padding-inline-start: var(--dtm-spacing-sm);
}

/*
 * Arrow now lives in the header between the path and the badge — a small
 * inline glyph that hints at the A→B delta without stealing body width.
 */
.dtm-diffcard__arrow {
  flex-shrink: 0;
  font-size: var(--dtm-font-size-md);
  color: var(--dtm-color-text-subtle);
}

/*
 * One-line delta summary chip (Tier 2). Matches the typography of the path
 * but is coloured to draw the eye to "what changed" without competing with
 * the bucket badge. `warning` palette aligns with the `changed` bucket.
 */
.dtm-diffcard__delta {
  flex-shrink: 0;
  padding: 1px var(--dtm-spacing-xs);
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-warning);
  background-color: var(--dtm-color-surface-muted);
  border-radius: var(--dtm-radius-sm);
  white-space: nowrap;
  max-width: 12ch;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * Stack the two columns on narrow cards (auto-fill grid picks the width).
 * Only applies to `changed`, where both sides are present and would
 * otherwise be cramped. `missing`/`extra` keep the absent side as a small
 * label and don't benefit from stacking; `matching` has two equal sides.
 */
@media (max-width: 480px) {
  .dtm-diffcard__body--changed,
  .dtm-diffcard__body--matching {
    grid-template-columns: 1fr;
  }

  .dtm-diffcard__arrow {
    display: none;
  }

  /*
   * When the columns stack, the between-column divider becomes a horizontal
   * rule above side B; flip the border to the block axis and reposition the
   * padding so the layout breathes correctly.
   */
  .dtm-diffcard__body--matching .dtm-diffcard__side--b,
  .dtm-diffcard__body--missing .dtm-diffcard__side--b,
  .dtm-diffcard__body--extra .dtm-diffcard__side--b,
  .dtm-diffcard__body--changed .dtm-diffcard__side--b {
    border-inline-start: none;
    border-block-start: 1px solid var(--dtm-color-border);
    padding-inline-start: 0;
    padding-block-start: var(--dtm-spacing-sm);
  }
}
</style>
