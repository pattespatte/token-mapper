<script setup lang="ts">
/**
 * DiffInspector — A/B modal detail view for a selected DiffCard.
 *
 * Sibling to `Inspector.vue` (which handles browse-mode selection). The two
 * share the modal shell pattern (focus trap, Esc/backdrop close, focus
 * restore, copy-path button) but have different state sources: this one
 * reads from `useGallery().selectedDiff`, a TokenDiff carrying one or both
 * resolved sides.
 *
 * Body layout:
 *   - `matching` / `changed` (both sides present): two columns side-by-side,
 *     each showing preview → resolved value → raw value (if different) →
 *     alias chain (if any).
 *   - `missing` (only A present): single A column; right column is the
 *     "not in set B" placeholder from the DiffCard body.
 *   - `extra` (only B present): single B column; left is "not in set A".
 *
 * Why a sibling component rather than a `mode` prop on Inspector.vue: the
 * two inspectors have different state sources (ResolvedToken vs TokenDiff),
 * different body layouts, and are mutually exclusive in the UI (browse vs
 * compare never coexist). Overloading Inspector with a mode branch would
 * tangle reactivity without saving meaningful code. Decision recorded in the
 * PRD (#1).
 */

import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useGallery } from '@/composables/useGallery'
import { useClipboard } from '@/composables/useClipboard'
import { getRenderer } from '@/renderers/registry'
import type { ResolvedToken } from '@dtcg-mapper/core'

const { selectedDiff, clearDiffSelection } = useGallery()
const { copied, copy: copyToClipboard, cleanup: cleanupClipboard } = useClipboard()

const dialogRef = ref<HTMLDivElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

/** Whether the modal is open. */
const isOpen = computed(() => selectedDiff.value !== null)

/** The currently selected diff (or null). */
const diff = computed(() => selectedDiff.value)

/** True when both A and B sides are present (matching / changed). */
const isSideBySide = computed(
  () => diff.value !== null && diff.value.a !== undefined && diff.value.b !== undefined
)

/** Pretty-print a value, with a graceful fallback for non-JSON values. */
function format(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** Side panel model — bundle everything the template needs for one side. */
interface SideView {
  token: ResolvedToken
  rawFormatted: string
  resolvedFormatted: string
  showRaw: boolean
  hasAliasChain: boolean
  renderer: ReturnType<typeof getRenderer> | null
}

/** Build a SideView from a ResolvedToken (or null when the side is absent). */
function sideViewOf(token: ResolvedToken | undefined): SideView | null {
  if (token === undefined) return null
  const rawFormatted = format(token.rawValue)
  const resolvedFormatted = format(token.resolvedValue)
  return {
    token,
    rawFormatted,
    resolvedFormatted,
    showRaw: rawFormatted !== resolvedFormatted,
    hasAliasChain: token.aliasChain.length > 0,
    renderer: getRenderer(token.type),
  }
}

const sideA = computed(() => sideViewOf(diff.value?.a))
const sideB = computed(() => sideViewOf(diff.value?.b))

async function copyPath(): Promise<void> {
  if (diff.value === null) return
  await copyToClipboard(diff.value.path)
}

/**
 * Document-level keydown handler: Esc closes; Tab/Shift-Tab wrap focus.
 * Mirrors the Inspector.vue pattern.
 */
function onKeydown(event: KeyboardEvent): void {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return
  const dialog = dialogRef.value
  if (dialog === null) return

  const focusables = getFocusable(dialog)
  if (focusables.length === 0) return

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (first === undefined || last === undefined) return

  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey) {
    if (active === first || active === null) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

/** Query visible, enabled focusables inside an element. */
function getFocusable(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  return Array.from(
    root.querySelectorAll<HTMLElement>(selector)
  ).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

/** Element that had focus when the dialog opened — restore on close. */
let previouslyFocused: HTMLElement | null = null

/** Close the dialog and clear the compare-mode selection. */
function close(): void {
  clearDiffSelection()
}

/** Close on backdrop click only (not clicks inside the dialog). */
function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    close()
  }
}

watch(isOpen, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    closeButtonRef.value?.focus()
  } else if (previouslyFocused !== null) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  cleanupClipboard()
})
</script>

<template>
  <div
    v-if="isOpen && diff"
    class="dtm-inspector-overlay"
    @click="onBackdropClick"
  >
    <div
      ref="dialogRef"
      class="dtm-inspector dtm-diffinspector"
      role="dialog"
      aria-modal="true"
      :aria-label="`A/B comparison for ${diff.path}`"
    >
      <header class="dtm-inspector__header">
        <div class="dtm-inspector__path-row">
          <code class="dtm-inspector__path">{{ diff.path }}</code>
          <span class="dtm-diffinspector__bucket">{{ diff.bucket }}</span>
          <button
            type="button"
            class="dtm-inspector__copy"
            :aria-label="copied ? 'Path copied' : `Copy ${diff.path}`"
            @click="copyPath"
          >
            {{ copied ? '✓ Copied' : '⧉ Copy' }}
          </button>
        </div>
        <button
          ref="closeButtonRef"
          type="button"
          class="dtm-inspector__close"
          aria-label="Close inspector"
          @click="close"
        >✕</button>
      </header>

      <div class="dtm-inspector__body dtm-diffinspector__body">
        <!-- Tier 2: "What changed" details list, shown only for changed
             tokens whose explainer produced a details array. Sits above
             the side-by-side A/B layout so the headline diff is the first
             thing the reader sees after opening the inspector. -->
        <section
          v-if="diff.bucket === 'changed' && diff.explanation?.details?.length"
          class="dtm-diffinspector__changed"
        >
          <h3 class="dtm-inspector__heading">What changed</h3>
          <dl class="dtm-diffinspector__changed-list">
            <div
              v-for="(d, i) in diff.explanation.details"
              :key="`${d.label}-${i}`"
              class="dtm-diffinspector__changed-row"
            >
              <dt>{{ d.label }}</dt>
              <dd>
                <code v-if="d.before">{{ d.before }}</code>
                <span v-else class="dtm-diffinspector__changed-empty">—</span>
                <span class="dtm-diffinspector__changed-arrow" aria-hidden="true">→</span>
                <code>{{ d.after }}</code>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Side-by-side: matching / changed -->
        <div v-if="isSideBySide" class="dtm-diffinspector__sides">
          <section v-if="sideA" class="dtm-diffinspector__side dtm-diffinspector__side--a">
            <h2 class="dtm-diffinspector__sidelabel">A</h2>
            <div v-if="sideA.renderer" class="dtm-inspector__preview">
              <component :is="sideA.renderer" :token="sideA.token" />
            </div>
            <section class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Resolved value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideA.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideA.showRaw" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Raw value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideA.rawFormatted }}</code></pre>
            </section>
            <section v-if="sideA.hasAliasChain" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Reference chain</h3>
              <ol class="dtm-inspector__chain">
                <li class="dtm-inspector__chain-start">
                  <code>{{ sideA.token.path }}</code>
                  <span class="dtm-inspector__chain-raw">= {{ sideA.rawFormatted }}</span>
                </li>
                <li
                  v-for="(hop, idx) in sideA.token.aliasChain"
                  :key="`a-${hop.path}-${idx}`"
                  class="dtm-inspector__chain-hop"
                >
                  <span class="dtm-inspector__chain-arrow" aria-hidden="true">→</span>
                  <code class="dtm-inspector__chain-path">{{ hop.path }}</code>
                  <span class="dtm-inspector__chain-raw">{{ hop.raw }}</span>
                  <span v-if="hop.resolved !== undefined" class="dtm-inspector__chain-resolved">
                    resolves to <code>{{ JSON.stringify(hop.resolved) }}</code>
                  </span>
                </li>
              </ol>
            </section>
          </section>

          <section v-if="sideB" class="dtm-diffinspector__side dtm-diffinspector__side--b">
            <h2 class="dtm-diffinspector__sidelabel">B</h2>
            <div v-if="sideB.renderer" class="dtm-inspector__preview">
              <component :is="sideB.renderer" :token="sideB.token" />
            </div>
            <section class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Resolved value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideB.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideB.showRaw" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Raw value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideB.rawFormatted }}</code></pre>
            </section>
            <section v-if="sideB.hasAliasChain" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Reference chain</h3>
              <ol class="dtm-inspector__chain">
                <li class="dtm-inspector__chain-start">
                  <code>{{ sideB.token.path }}</code>
                  <span class="dtm-inspector__chain-raw">= {{ sideB.rawFormatted }}</span>
                </li>
                <li
                  v-for="(hop, idx) in sideB.token.aliasChain"
                  :key="`b-${hop.path}-${idx}`"
                  class="dtm-inspector__chain-hop"
                >
                  <span class="dtm-inspector__chain-arrow" aria-hidden="true">→</span>
                  <code class="dtm-inspector__chain-path">{{ hop.path }}</code>
                  <span class="dtm-inspector__chain-raw">{{ hop.raw }}</span>
                  <span v-if="hop.resolved !== undefined" class="dtm-inspector__chain-resolved">
                    resolves to <code>{{ JSON.stringify(hop.resolved) }}</code>
                  </span>
                </li>
              </ol>
            </section>
          </section>
        </div>

        <!-- Single-side: missing (A only) or extra (B only) -->
        <div v-else class="dtm-diffinspector__single">
          <section v-if="sideA" class="dtm-diffinspector__side dtm-diffinspector__side--a">
            <h2 class="dtm-diffinspector__sidelabel">A</h2>
            <div v-if="sideA.renderer" class="dtm-inspector__preview">
              <component :is="sideA.renderer" :token="sideA.token" />
            </div>
            <section class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Resolved value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideA.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideA.showRaw" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Raw value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideA.rawFormatted }}</code></pre>
            </section>
          </section>
          <p v-else class="dtm-diffinspector__absent">not in set A</p>

          <section v-if="sideB" class="dtm-diffinspector__side dtm-diffinspector__side--b">
            <h2 class="dtm-diffinspector__sidelabel">B</h2>
            <div v-if="sideB.renderer" class="dtm-inspector__preview">
              <component :is="sideB.renderer" :token="sideB.token" />
            </div>
            <section class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Resolved value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideB.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideB.showRaw" class="dtm-inspector__section">
              <h3 class="dtm-inspector__heading">Raw value</h3>
              <pre class="dtm-inspector__code"><code>{{ sideB.rawFormatted }}</code></pre>
            </section>
          </section>
          <p v-else class="dtm-diffinspector__absent">not in set B</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reuse Inspector.vue's modal vocabulary (dtm-inspector-*) so the two modal
   types read as a family. A few dtm-diffinspector-* additions carry the A/B
   layout specifics. */

.dtm-diffinspector {
  max-width: 900px; /* wider than Inspector's 640px — two columns need room */
}

.dtm-diffinspector__bucket {
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text-subtle);
  background-color: var(--dtm-color-surface-muted);
  padding: 2px var(--dtm-spacing-xs);
  border-radius: var(--dtm-radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtm-diffinspector__body {
  gap: var(--dtm-spacing-md);
}

/*
 * Tier 2 "What changed" section — field-by-field diff list shown above
 * the side-by-side A/B layout for `changed` tokens. Reuses the heading
 * typography of the existing inspector sections for visual consistency.
 */
.dtm-diffinspector__changed {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-sm) var(--dtm-spacing-md);
  background-color: var(--dtm-color-surface-muted);
  border: 1px solid var(--dtm-color-border);
  border-left: 3px solid var(--dtm-color-warning);
  border-radius: var(--dtm-radius-md);
}

.dtm-diffinspector__changed-list {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dtm-spacing-xs) var(--dtm-spacing-md);
  font-size: var(--dtm-font-size-sm);
}

.dtm-diffinspector__changed-row {
  display: contents;
}

.dtm-diffinspector__changed-row dt {
  color: var(--dtm-color-text-subtle);
  font-family: var(--dtm-font-family-mono);
}

.dtm-diffinspector__changed-row dd {
  margin: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--dtm-spacing-xs);
  color: var(--dtm-color-text);
  font-family: var(--dtm-font-family-mono);
}

.dtm-diffinspector__changed-row dd code {
  font-family: inherit;
  word-break: break-all;
}

.dtm-diffinspector__changed-arrow {
  color: var(--dtm-color-text-subtle);
}

.dtm-diffinspector__changed-empty {
  color: var(--dtm-color-text-subtle);
  font-style: italic;
}

.dtm-diffinspector__sides {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--dtm-spacing-md);
}

.dtm-diffinspector__single {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-md);
}

.dtm-diffinspector__side {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-sm);
  min-width: 0;
}

.dtm-diffinspector__sides .dtm-diffinspector__side--b {
  border-inline-start: 1px solid var(--dtm-color-border);
  padding-inline-start: var(--dtm-spacing-md);
}

.dtm-diffinspector__sidelabel {
  align-self: flex-start;
  margin: 0;
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

.dtm-diffinspector__absent {
  margin: 0;
  padding: var(--dtm-spacing-md);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  font-style: italic;
  background-color: var(--dtm-color-surface-muted);
  border-radius: var(--dtm-radius-md);
  text-align: center;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* The Inspector.vue CSS classes below are scoped to its own component; we
   re-declare the ones we reuse here so this component is self-contained
   (Vue scoped CSS doesn't bleed across components). */

.dtm-inspector__section {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
}

.dtm-inspector__heading {
  margin: 0;
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtm-inspector__preview {
  padding: var(--dtm-spacing-sm);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
}

.dtm-inspector__code {
  margin: 0;
  padding: var(--dtm-spacing-sm);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.dtm-inspector__chain {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
}

.dtm-inspector__chain-start,
.dtm-inspector__chain-hop {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  background-color: var(--dtm-color-surface);
  border-radius: var(--dtm-radius-sm);
  font-size: var(--dtm-font-size-sm);
}

.dtm-inspector__chain-start {
  font-weight: var(--dtm-font-weight-medium);
}

.dtm-inspector__chain-arrow {
  color: var(--dtm-color-text-subtle);
}

.dtm-inspector__chain-path,
.dtm-inspector__chain-raw,
.dtm-inspector__chain-resolved code {
  font-family: var(--dtm-font-family-mono);
}

.dtm-inspector__chain-raw {
  color: var(--dtm-color-text-subtle);
}

.dtm-inspector__chain-resolved {
  color: var(--dtm-color-text-muted);
}

.dtm-inspector__chain-resolved code {
  color: var(--dtm-color-accent);
}

/* The overlay/header/close/copy/path styles come from Inspector.vue and are
   scoped to it; we duplicate the minimum needed here for the modal shell. */
.dtm-inspector-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(10, 13, 18, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dtm-spacing-lg);
  z-index: 100;
}

.dtm-inspector {
  background-color: var(--dtm-color-bg);
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-lg);
  box-shadow: 0 10px 30px rgba(10, 13, 18, 0.2);
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dtm-inspector__header {
  display: flex;
  align-items: flex-start;
  gap: var(--dtm-spacing-sm);
  padding: var(--dtm-spacing-md);
  border-bottom: 1px solid var(--dtm-color-border);
}

.dtm-inspector__path-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
  min-width: 0;
}

.dtm-inspector__path {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-md);
  color: var(--dtm-color-text);
  word-break: break-all;
}

.dtm-inspector__copy {
  flex-shrink: 0;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-muted);
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
}

.dtm-inspector__copy:hover {
  color: var(--dtm-color-accent);
  border-color: var(--dtm-color-accent);
}

.dtm-inspector__close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  font-size: var(--dtm-font-size-md);
  color: var(--dtm-color-text-subtle);
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtm-inspector__close:hover {
  color: var(--dtm-color-error);
  border-color: var(--dtm-color-error);
}

.dtm-inspector__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--dtm-spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-md);
}

/* Stack the two sides under 640px so the inspector stays usable on phones. */
@media (max-width: 640px) {
  .dtm-diffinspector__sides {
    grid-template-columns: 1fr;
  }

  .dtm-diffinspector__sides .dtm-diffinspector__side--b {
    border-inline-start: none;
    border-block-start: 1px solid var(--dtm-color-border);
    padding-inline-start: 0;
    padding-block-start: var(--dtm-spacing-md);
  }
}
</style>
