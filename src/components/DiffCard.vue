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
import type { TokenDiff } from '@/types/diff'
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
    class="dtv-diffcard"
    :class="`dtv-diffcard--${diff.bucket}`"
    :aria-label="`Token ${diff.path}, ${diff.bucket}. Activate to open inspector.`"
    role="button"
    tabindex="0"
    @click="onSelect"
    @keydown="onCardKeydown"
  >
    <header class="dtv-diffcard__header">
      <code class="dtv-diffcard__path" :title="diff.path">{{ diff.path }}</code>
      <!-- Arrow hint shown only for changed tokens; lives in the header so it
           doesn't steal a body grid column from the side-by-side visuals. -->
      <span
        v-if="diff.bucket === 'changed'"
        class="dtv-diffcard__arrow"
        aria-hidden="true"
        >→</span
      >
      <!-- One-line delta summary from the explainer (Tier 2). Compact chip
           rendered only for `changed` tokens with an explanation. -->
      <span
        v-if="diff.bucket === 'changed' && diff.explanation"
        class="dtv-diffcard__delta"
        :title="`What changed: ${diff.explanation.summary}`"
      >{{ diff.explanation.summary }}</span>
      <DiffBadge :bucket="diff.bucket" />
      <button
        type="button"
        class="dtv-diffcard__copy"
        :aria-label="copied ? 'Path copied' : `Copy ${diff.path}`"
        @click.stop="copyPath"
      >
        {{ copied ? '✓' : '⧉' }}
      </button>
    </header>

    <div class="dtv-diffcard__body" :class="`dtv-diffcard__body--${diff.bucket}`">
      <!-- Set A column -->
      <div class="dtv-diffcard__side dtv-diffcard__side--a">
        <span class="dtv-diffcard__sidelabel">A</span>
        <TokenVisual v-if="diff.a" :token="diff.a" />
        <p v-else class="dtv-diffcard__absent">not in set A</p>
      </div>

      <!-- Set B column -->
      <div class="dtv-diffcard__side dtv-diffcard__side--b">
        <span class="dtv-diffcard__sidelabel">B</span>
        <TokenVisual v-if="diff.b" :token="diff.b" />
        <p v-else class="dtv-diffcard__absent">not in set B</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.dtv-diffcard {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
  padding: var(--dtv-spacing-md);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
  border-left: 3px solid var(--dtv-color-border-strong);
  /* Card-as-button affordance: cursor + focus ring. */
  cursor: pointer;
}

.dtv-diffcard:hover {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-diffcard:focus-visible {
  outline: 2px solid var(--dtv-color-accent);
  outline-offset: 2px;
}

.dtv-diffcard--selected {
  border-color: var(--dtv-color-accent);
  box-shadow: 0 0 0 2px var(--dtv-color-accent);
}

/*
 * Coloured left border per bucket — at-a-glance scanning without the badge.
 * Matches DiffBadge colours.
 */
.dtv-diffcard--matching {
  border-left-color: var(--dtv-color-success);
}

.dtv-diffcard--changed {
  border-left-color: var(--dtv-color-warning);
}

.dtv-diffcard--missing {
  border-left-color: var(--dtv-color-error);
}

.dtv-diffcard--extra {
  border-left-color: var(--dtv-color-info);
}

.dtv-diffcard__header {
  display: flex;
  align-items: center;
  gap: var(--dtv-spacing-xs);
}

.dtv-diffcard__path {
  flex: 1;
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-muted);
  word-break: break-all;
  line-height: 1.3;
}

.dtv-diffcard__copy {
  flex-shrink: 0;
  padding: 2px var(--dtv-spacing-xs);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtv-diffcard__copy:hover {
  color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-diffcard__body {
  display: grid;
  gap: var(--dtv-spacing-sm);
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
.dtv-diffcard__body--matching,
.dtv-diffcard__body--changed {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.dtv-diffcard__body--missing {
  grid-template-columns: minmax(0, 1fr) auto;
}

.dtv-diffcard__body--extra {
  grid-template-columns: auto minmax(0, 1fr);
}

/*
 * Each side is a row: the A/B label sits inline on the left and the visual
 * (or absent placeholder) fills the rest, vertically centered. This keeps
 * the label on the same baseline as the content's top region and lets the
 * content area stretch to the side's full height.
 */
.dtv-diffcard__side {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: var(--dtv-spacing-sm);
  min-width: 0;
}

/*
 * The A/B label is a small pill so the side anchor is unmistakable. Kept
 * neutral (not coloured per side) so it doesn't fight the bucket-coloured
 * left border / DiffBadge; the letter itself carries the A-vs-B meaning.
 */
.dtv-diffcard__sidelabel {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;
  padding: 2px var(--dtv-spacing-xs);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface-muted);
  border: 1px solid var(--dtv-color-border);
  font-family: var(--dtv-font-family-mono);
  line-height: 1.3;
}

/*
 * The visual/absent wrapper fills the side's remaining width and full
 * height so an inner block can grow to match the opposite side.
 */
.dtv-diffcard__side > :not(.dtv-diffcard__sidelabel) {
  flex: 1 1 auto;
  min-width: 0;
}

.dtv-diffcard__absent {
  margin: 0;
  padding: var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
  font-style: italic;
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-md);
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
.dtv-diffcard__body--matching .dtv-diffcard__side--b,
.dtv-diffcard__body--missing .dtv-diffcard__side--b,
.dtv-diffcard__body--extra .dtv-diffcard__side--b,
.dtv-diffcard__body--changed .dtv-diffcard__side--b {
  border-inline-start: 1px solid var(--dtv-color-border);
  padding-inline-start: var(--dtv-spacing-sm);
}

/*
 * Arrow now lives in the header between the path and the badge — a small
 * inline glyph that hints at the A→B delta without stealing body width.
 */
.dtv-diffcard__arrow {
  flex-shrink: 0;
  font-size: var(--dtv-font-size-md);
  color: var(--dtv-color-text-subtle);
}

/*
 * One-line delta summary chip (Tier 2). Matches the typography of the path
 * but is coloured to draw the eye to "what changed" without competing with
 * the bucket badge. `warning` palette aligns with the `changed` bucket.
 */
.dtv-diffcard__delta {
  flex-shrink: 0;
  padding: 1px var(--dtv-spacing-xs);
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-warning);
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-sm);
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
  .dtv-diffcard__body--changed,
  .dtv-diffcard__body--matching {
    grid-template-columns: 1fr;
  }

  .dtv-diffcard__arrow {
    display: none;
  }

  /*
   * When the columns stack, the between-column divider becomes a horizontal
   * rule above side B; flip the border to the block axis and reposition the
   * padding so the layout breathes correctly.
   */
  .dtv-diffcard__body--matching .dtv-diffcard__side--b,
  .dtv-diffcard__body--missing .dtv-diffcard__side--b,
  .dtv-diffcard__body--extra .dtv-diffcard__side--b,
  .dtv-diffcard__body--changed .dtv-diffcard__side--b {
    border-inline-start: none;
    border-block-start: 1px solid var(--dtv-color-border);
    padding-inline-start: 0;
    padding-block-start: var(--dtv-spacing-sm);
  }
}
</style>
