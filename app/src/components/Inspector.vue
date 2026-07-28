<script setup lang="ts">
/**
 * Inspector — modal detail view for a selected token.
 *
 * Triggered when a browse-mode TokenCard is clicked (its path lands in
 * useGallery.selectedTokenPath). Shows the full picture a designer needs
 * when tracing a token:
 *   - dotted path (with copy button)
 *   - $type, $description
 *   - raw value (what's literally in the JSON — may be a `{...}` reference)
 *   - resolved value (the literal at the end of the reference chain)
 *   - full alias chain, hop by hop, when the token is an alias
 *   - a live preview via the token's renderer
 *
 * Keyboard (standard modal pattern):
 *   - Esc closes
 *   - Tab and Shift-Tab cycle within the dialog (focus trap)
 *   - focus moves to the close button on open
 *   - focus is restored to the triggering element on close
 *   - backdrop click also closes
 *
 * Scope note: browse-mode only in v1. Compare-mode selection would need
 * DiffCard to emit select + a parallel selectedDiffPath; deferred to a
 * future iteration. The inspector requirements are met by browse mode.
 */

import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useGallery } from '@/composables/useGallery'
import { useClipboard } from '@/composables/useClipboard'
import { getRenderer } from '@/renderers/registry'

const { selectedToken, clearSelection } = useGallery()
const { copied, copy: copyToClipboard, cleanup: cleanupClipboard } = useClipboard()

const dialogRef = ref<HTMLDivElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

/** Whether the modal is open (selectedToken is non-null and open). */
const isOpen = computed(() => selectedToken.value !== null)

/** The currently selected resolved token (or null). */
const token = computed(() => selectedToken.value)

/** Renderer component for the live preview. */
const renderer = computed(() =>
  token.value ? getRenderer(token.value.type) : null
)

/** Pretty-printed raw value. */
const rawFormatted = computed(() => {
  if (token.value === null) return ''
  try {
    return JSON.stringify(token.value.rawValue, null, 2)
  } catch {
    return String(token.value.rawValue)
  }
})

/** Pretty-printed resolved value. */
const resolvedFormatted = computed(() => {
  if (token.value === null) return ''
  try {
    return JSON.stringify(token.value.resolvedValue, null, 2)
  } catch {
    return String(token.value.resolvedValue)
  }
})

/**
 * Show the raw-value section when it differs from the resolved value. This
 * covers two cases the previous `hasAliasChain`-only gate missed: composite
 * values with internal references (aliasChain now populated post-fix), and
 * errored-resolution tokens where the raw `{...}` differs from the fallback
 * resolved form.
 */
const showRawSection = computed(
  () =>
    token.value !== null && rawFormatted.value !== resolvedFormatted.value
)

/** True when the token has at least one alias hop — gates the Reference chain section. */
const hasAliasChain = computed(
  () => token.value !== null && token.value.aliasChain.length > 0
)

async function copyPath(): Promise<void> {
  if (token.value === null) return
  await copyToClipboard(token.value.path)
}

/**
 * Document-level keydown handler: Esc closes the dialog; Tab / Shift-Tab
 * wraps focus within the dialog. Attached while the dialog is open.
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

  // Build the focusable-element list lazily on each Tab. Cheap (a few
  // elements) and avoids stale caches if the dialog content ever changes
  // dynamically (e.g. async-loaded descriptions).
  const focusables = getFocusable(dialog)
  if (focusables.length === 0) return

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (first === undefined || last === undefined) return

  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey) {
    // Shift-Tab on the first element wraps to the last.
    if (active === first || active === null) {
      event.preventDefault()
      last.focus()
    }
  } else {
    // Tab on the last element wraps to the first.
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
    (el) =>
      el.offsetParent !== null || el === document.activeElement
  )
}

/** Element that had focus when the dialog opened — restore it on close. */
let previouslyFocused: HTMLElement | null = null

/** Close the dialog and clear selection. */
function close(): void {
  clearSelection()
}

/**
 * Close on backdrop click (click on the overlay, not inside the dialog).
 */
function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    close()
  }
}

/**
 * On open: record the trigger, move focus into the dialog. On close: restore
 * focus to the trigger.
 */
watch(isOpen, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    closeButtonRef.value?.focus()
  } else if (previouslyFocused !== null) {
    // Restore on close. nextTick not needed — Vue has already removed the
    // dialog from the DOM at this point.
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
    v-if="isOpen && token"
    class="dtm-inspector-overlay"
    @click="onBackdropClick"
  >
    <div
      ref="dialogRef"
      class="dtm-inspector"
      role="dialog"
      aria-modal="true"
      :aria-label="`Token details for ${token.path}`"
    >
      <header class="dtm-inspector__header">
        <div class="dtm-inspector__path-row">
          <code class="dtm-inspector__path">{{ token.path }}</code>
          <button
            type="button"
            class="dtm-inspector__copy"
            :aria-label="copied ? 'Path copied' : `Copy ${token.path}`"
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

      <div class="dtm-inspector__body">
        <!-- Metadata -->
        <dl class="dtm-inspector__meta">
          <div class="dtm-inspector__row">
            <dt>Type</dt>
            <dd><code>{{ token.type ?? 'unknown' }}</code></dd>
          </div>
          <div v-if="token.description" class="dtm-inspector__row">
            <dt>Description</dt>
            <dd>{{ token.description }}</dd>
          </div>
          <div v-if="token.hasError" class="dtm-inspector__row dtm-inspector__row--error">
            <dt>Status</dt>
            <dd>Reference could not be fully resolved (dangling or cyclic).</dd>
          </div>
        </dl>

        <!-- Live preview -->
        <section class="dtm-inspector__section">
          <h2 class="dtm-inspector__heading">Preview</h2>
          <div v-if="renderer" class="dtm-inspector__preview">
            <component :is="renderer" :token="token" />
          </div>
        </section>

        <!-- Resolved value -->
        <section class="dtm-inspector__section">
          <h2 class="dtm-inspector__heading">Resolved value</h2>
          <pre class="dtm-inspector__code"><code>{{ resolvedFormatted }}</code></pre>
        </section>

        <!-- Raw value (only shown when it differs from resolved) -->
        <section v-if="showRawSection" class="dtm-inspector__section">
          <h2 class="dtm-inspector__heading">Raw value</h2>
          <pre class="dtm-inspector__code"><code>{{ rawFormatted }}</code></pre>
        </section>

        <!-- Alias chain — the headline inspector feature -->
        <section v-if="hasAliasChain" class="dtm-inspector__section">
          <h2 class="dtm-inspector__heading">Reference chain</h2>
          <ol class="dtm-inspector__chain">
            <li class="dtm-inspector__chain-start">
              <code>{{ token.path }}</code>
              <span class="dtm-inspector__chain-raw">= {{ rawFormatted }}</span>
            </li>
            <li
              v-for="(hop, idx) in token.aliasChain"
              :key="`${hop.path}-${idx}`"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.dtm-inspector__meta {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dtm-spacing-xs) var(--dtm-spacing-md);
  font-size: var(--dtm-font-size-sm);
}

.dtm-inspector__row {
  display: contents;
}

.dtm-inspector__row dt {
  color: var(--dtm-color-text-subtle);
  font-weight: var(--dtm-font-weight-medium);
}

.dtm-inspector__row dd {
  margin: 0;
  color: var(--dtm-color-text);
  word-break: break-word;
}

.dtm-inspector__row--error dd {
  color: var(--dtm-color-error);
}

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
  padding: var(--dtm-spacing-md);
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
</style>
