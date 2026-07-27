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
    class="dtv-inspector-overlay"
    @click="onBackdropClick"
  >
    <div
      ref="dialogRef"
      class="dtv-inspector dtv-diffinspector"
      role="dialog"
      aria-modal="true"
      :aria-label="`A/B comparison for ${diff.path}`"
    >
      <header class="dtv-inspector__header">
        <div class="dtv-inspector__path-row">
          <code class="dtv-inspector__path">{{ diff.path }}</code>
          <span class="dtv-diffinspector__bucket">{{ diff.bucket }}</span>
          <button
            type="button"
            class="dtv-inspector__copy"
            :aria-label="copied ? 'Path copied' : `Copy ${diff.path}`"
            @click="copyPath"
          >
            {{ copied ? '✓ Copied' : '⧉ Copy' }}
          </button>
        </div>
        <button
          ref="closeButtonRef"
          type="button"
          class="dtv-inspector__close"
          aria-label="Close inspector"
          @click="close"
        >✕</button>
      </header>

      <div class="dtv-inspector__body dtv-diffinspector__body">
        <!-- Tier 2: "What changed" details list, shown only for changed
             tokens whose explainer produced a details array. Sits above
             the side-by-side A/B layout so the headline diff is the first
             thing the reader sees after opening the inspector. -->
        <section
          v-if="diff.bucket === 'changed' && diff.explanation?.details?.length"
          class="dtv-diffinspector__changed"
        >
          <h3 class="dtv-inspector__heading">What changed</h3>
          <dl class="dtv-diffinspector__changed-list">
            <div
              v-for="(d, i) in diff.explanation.details"
              :key="`${d.label}-${i}`"
              class="dtv-diffinspector__changed-row"
            >
              <dt>{{ d.label }}</dt>
              <dd>
                <code v-if="d.before">{{ d.before }}</code>
                <span v-else class="dtv-diffinspector__changed-empty">—</span>
                <span class="dtv-diffinspector__changed-arrow" aria-hidden="true">→</span>
                <code>{{ d.after }}</code>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Side-by-side: matching / changed -->
        <div v-if="isSideBySide" class="dtv-diffinspector__sides">
          <section v-if="sideA" class="dtv-diffinspector__side dtv-diffinspector__side--a">
            <h2 class="dtv-diffinspector__sidelabel">A</h2>
            <div v-if="sideA.renderer" class="dtv-inspector__preview">
              <component :is="sideA.renderer" :token="sideA.token" />
            </div>
            <section class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Resolved value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideA.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideA.showRaw" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Raw value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideA.rawFormatted }}</code></pre>
            </section>
            <section v-if="sideA.hasAliasChain" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Reference chain</h3>
              <ol class="dtv-inspector__chain">
                <li class="dtv-inspector__chain-start">
                  <code>{{ sideA.token.path }}</code>
                  <span class="dtv-inspector__chain-raw">= {{ sideA.rawFormatted }}</span>
                </li>
                <li
                  v-for="(hop, idx) in sideA.token.aliasChain"
                  :key="`a-${hop.path}-${idx}`"
                  class="dtv-inspector__chain-hop"
                >
                  <span class="dtv-inspector__chain-arrow" aria-hidden="true">→</span>
                  <code class="dtv-inspector__chain-path">{{ hop.path }}</code>
                  <span class="dtv-inspector__chain-raw">{{ hop.raw }}</span>
                  <span v-if="hop.resolved !== undefined" class="dtv-inspector__chain-resolved">
                    resolves to <code>{{ JSON.stringify(hop.resolved) }}</code>
                  </span>
                </li>
              </ol>
            </section>
          </section>

          <section v-if="sideB" class="dtv-diffinspector__side dtv-diffinspector__side--b">
            <h2 class="dtv-diffinspector__sidelabel">B</h2>
            <div v-if="sideB.renderer" class="dtv-inspector__preview">
              <component :is="sideB.renderer" :token="sideB.token" />
            </div>
            <section class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Resolved value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideB.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideB.showRaw" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Raw value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideB.rawFormatted }}</code></pre>
            </section>
            <section v-if="sideB.hasAliasChain" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Reference chain</h3>
              <ol class="dtv-inspector__chain">
                <li class="dtv-inspector__chain-start">
                  <code>{{ sideB.token.path }}</code>
                  <span class="dtv-inspector__chain-raw">= {{ sideB.rawFormatted }}</span>
                </li>
                <li
                  v-for="(hop, idx) in sideB.token.aliasChain"
                  :key="`b-${hop.path}-${idx}`"
                  class="dtv-inspector__chain-hop"
                >
                  <span class="dtv-inspector__chain-arrow" aria-hidden="true">→</span>
                  <code class="dtv-inspector__chain-path">{{ hop.path }}</code>
                  <span class="dtv-inspector__chain-raw">{{ hop.raw }}</span>
                  <span v-if="hop.resolved !== undefined" class="dtv-inspector__chain-resolved">
                    resolves to <code>{{ JSON.stringify(hop.resolved) }}</code>
                  </span>
                </li>
              </ol>
            </section>
          </section>
        </div>

        <!-- Single-side: missing (A only) or extra (B only) -->
        <div v-else class="dtv-diffinspector__single">
          <section v-if="sideA" class="dtv-diffinspector__side dtv-diffinspector__side--a">
            <h2 class="dtv-diffinspector__sidelabel">A</h2>
            <div v-if="sideA.renderer" class="dtv-inspector__preview">
              <component :is="sideA.renderer" :token="sideA.token" />
            </div>
            <section class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Resolved value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideA.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideA.showRaw" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Raw value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideA.rawFormatted }}</code></pre>
            </section>
          </section>
          <p v-else class="dtv-diffinspector__absent">not in set A</p>

          <section v-if="sideB" class="dtv-diffinspector__side dtv-diffinspector__side--b">
            <h2 class="dtv-diffinspector__sidelabel">B</h2>
            <div v-if="sideB.renderer" class="dtv-inspector__preview">
              <component :is="sideB.renderer" :token="sideB.token" />
            </div>
            <section class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Resolved value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideB.resolvedFormatted }}</code></pre>
            </section>
            <section v-if="sideB.showRaw" class="dtv-inspector__section">
              <h3 class="dtv-inspector__heading">Raw value</h3>
              <pre class="dtv-inspector__code"><code>{{ sideB.rawFormatted }}</code></pre>
            </section>
          </section>
          <p v-else class="dtv-diffinspector__absent">not in set B</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reuse Inspector.vue's modal vocabulary (dtv-inspector-*) so the two modal
   types read as a family. A few dtv-diffinspector-* additions carry the A/B
   layout specifics. */

.dtv-diffinspector {
  max-width: 900px; /* wider than Inspector's 640px — two columns need room */
}

.dtv-diffinspector__bucket {
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text-subtle);
  background-color: var(--dtv-color-surface-muted);
  padding: 2px var(--dtv-spacing-xs);
  border-radius: var(--dtv-radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtv-diffinspector__body {
  gap: var(--dtv-spacing-md);
}

/*
 * Tier 2 "What changed" section — field-by-field diff list shown above
 * the side-by-side A/B layout for `changed` tokens. Reuses the heading
 * typography of the existing inspector sections for visual consistency.
 */
.dtv-diffinspector__changed {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
  padding: var(--dtv-spacing-sm) var(--dtv-spacing-md);
  background-color: var(--dtv-color-surface-muted);
  border: 1px solid var(--dtv-color-border);
  border-left: 3px solid var(--dtv-color-warning);
  border-radius: var(--dtv-radius-md);
}

.dtv-diffinspector__changed-list {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
}

.dtv-diffinspector__changed-row {
  display: contents;
}

.dtv-diffinspector__changed-row dt {
  color: var(--dtv-color-text-subtle);
  font-family: var(--dtv-font-family-mono);
}

.dtv-diffinspector__changed-row dd {
  margin: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  color: var(--dtv-color-text);
  font-family: var(--dtv-font-family-mono);
}

.dtv-diffinspector__changed-row dd code {
  font-family: inherit;
  word-break: break-all;
}

.dtv-diffinspector__changed-arrow {
  color: var(--dtv-color-text-subtle);
}

.dtv-diffinspector__changed-empty {
  color: var(--dtv-color-text-subtle);
  font-style: italic;
}

.dtv-diffinspector__sides {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--dtv-spacing-md);
}

.dtv-diffinspector__single {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-md);
}

.dtv-diffinspector__side {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
  min-width: 0;
}

.dtv-diffinspector__sides .dtv-diffinspector__side--b {
  border-inline-start: 1px solid var(--dtv-color-border);
  padding-inline-start: var(--dtv-spacing-md);
}

.dtv-diffinspector__sidelabel {
  align-self: flex-start;
  margin: 0;
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

.dtv-diffinspector__absent {
  margin: 0;
  padding: var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
  font-style: italic;
  background-color: var(--dtv-color-surface-muted);
  border-radius: var(--dtv-radius-md);
  text-align: center;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* The Inspector.vue CSS classes below are scoped to its own component; we
   re-declare the ones we reuse here so this component is self-contained
   (Vue scoped CSS doesn't bleed across components). */

.dtv-inspector__section {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
}

.dtv-inspector__heading {
  margin: 0;
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtv-inspector__preview {
  padding: var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
}

.dtv-inspector__code {
  margin: 0;
  padding: var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.dtv-inspector__chain {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
}

.dtv-inspector__chain-start,
.dtv-inspector__chain-hop {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--dtv-spacing-xs);
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  background-color: var(--dtv-color-surface);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
}

.dtv-inspector__chain-start {
  font-weight: var(--dtv-font-weight-medium);
}

.dtv-inspector__chain-arrow {
  color: var(--dtv-color-text-subtle);
}

.dtv-inspector__chain-path,
.dtv-inspector__chain-raw,
.dtv-inspector__chain-resolved code {
  font-family: var(--dtv-font-family-mono);
}

.dtv-inspector__chain-raw {
  color: var(--dtv-color-text-subtle);
}

.dtv-inspector__chain-resolved {
  color: var(--dtv-color-text-muted);
}

.dtv-inspector__chain-resolved code {
  color: var(--dtv-color-accent);
}

/* The overlay/header/close/copy/path styles come from Inspector.vue and are
   scoped to it; we duplicate the minimum needed here for the modal shell. */
.dtv-inspector-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(10, 13, 18, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dtv-spacing-lg);
  z-index: 100;
}

.dtv-inspector {
  background-color: var(--dtv-color-bg);
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-lg);
  box-shadow: 0 10px 30px rgba(10, 13, 18, 0.2);
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dtv-inspector__header {
  display: flex;
  align-items: flex-start;
  gap: var(--dtv-spacing-sm);
  padding: var(--dtv-spacing-md);
  border-bottom: 1px solid var(--dtv-color-border);
}

.dtv-inspector__path-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--dtv-spacing-xs);
  min-width: 0;
}

.dtv-inspector__path {
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-md);
  color: var(--dtv-color-text);
  word-break: break-all;
}

.dtv-inspector__copy {
  flex-shrink: 0;
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-muted);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  cursor: pointer;
}

.dtv-inspector__copy:hover {
  color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-inspector__close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  font-size: var(--dtv-font-size-md);
  color: var(--dtv-color-text-subtle);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtv-inspector__close:hover {
  color: var(--dtv-color-error);
  border-color: var(--dtv-color-error);
}

.dtv-inspector__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--dtv-spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-md);
}

/* Stack the two sides under 640px so the inspector stays usable on phones. */
@media (max-width: 640px) {
  .dtv-diffinspector__sides {
    grid-template-columns: 1fr;
  }

  .dtv-diffinspector__sides .dtv-diffinspector__side--b {
    border-inline-start: none;
    border-block-start: 1px solid var(--dtv-color-border);
    padding-inline-start: 0;
    padding-block-start: var(--dtv-spacing-md);
  }
}
</style>
