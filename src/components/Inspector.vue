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
import { getRenderer } from '@/renderers/registry'

const { selectedToken, clearSelection } = useGallery()

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

/** Copy state for the path button. */
const copied = ref(false)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyPath(): Promise<void> {
  if (token.value === null) return
  try {
    await navigator.clipboard.writeText(token.value.path)
    copied.value = true
    if (copyResetTimer !== null) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copied.value = false
      copyResetTimer = null
    }, 1200)
  } catch {
    // Clipboard may be unavailable; fail silently.
  }
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
  if (copyResetTimer !== null) clearTimeout(copyResetTimer)
})
</script>

<template>
  <div
    v-if="isOpen && token"
    class="dtv-inspector-overlay"
    @click="onBackdropClick"
  >
    <div
      ref="dialogRef"
      class="dtv-inspector"
      role="dialog"
      aria-modal="true"
      :aria-label="`Token details for ${token.path}`"
    >
      <header class="dtv-inspector__header">
        <div class="dtv-inspector__path-row">
          <code class="dtv-inspector__path">{{ token.path }}</code>
          <button
            type="button"
            class="dtv-inspector__copy"
            :aria-label="copied ? 'Path copied' : `Copy ${token.path}`"
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

      <div class="dtv-inspector__body">
        <!-- Metadata -->
        <dl class="dtv-inspector__meta">
          <div class="dtv-inspector__row">
            <dt>Type</dt>
            <dd><code>{{ token.type ?? 'unknown' }}</code></dd>
          </div>
          <div v-if="token.description" class="dtv-inspector__row">
            <dt>Description</dt>
            <dd>{{ token.description }}</dd>
          </div>
          <div v-if="token.hasError" class="dtv-inspector__row dtv-inspector__row--error">
            <dt>Status</dt>
            <dd>Reference could not be fully resolved (dangling or cyclic).</dd>
          </div>
        </dl>

        <!-- Live preview -->
        <section class="dtv-inspector__section">
          <h2 class="dtv-inspector__heading">Preview</h2>
          <div v-if="renderer" class="dtv-inspector__preview">
            <component :is="renderer" :token="token" />
          </div>
        </section>

        <!-- Resolved value -->
        <section class="dtv-inspector__section">
          <h2 class="dtv-inspector__heading">Resolved value</h2>
          <pre class="dtv-inspector__code"><code>{{ resolvedFormatted }}</code></pre>
        </section>

        <!-- Raw value (only shown when it differs from resolved) -->
        <section v-if="showRawSection" class="dtv-inspector__section">
          <h2 class="dtv-inspector__heading">Raw value</h2>
          <pre class="dtv-inspector__code"><code>{{ rawFormatted }}</code></pre>
        </section>

        <!-- Alias chain — the headline inspector feature -->
        <section v-if="hasAliasChain" class="dtv-inspector__section">
          <h2 class="dtv-inspector__heading">Reference chain</h2>
          <ol class="dtv-inspector__chain">
            <li class="dtv-inspector__chain-start">
              <code>{{ token.path }}</code>
              <span class="dtv-inspector__chain-raw">= {{ rawFormatted }}</span>
            </li>
            <li
              v-for="(hop, idx) in token.aliasChain"
              :key="`${hop.path}-${idx}`"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.dtv-inspector__meta {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
}

.dtv-inspector__row {
  display: contents;
}

.dtv-inspector__row dt {
  color: var(--dtv-color-text-subtle);
  font-weight: var(--dtv-font-weight-medium);
}

.dtv-inspector__row dd {
  margin: 0;
  color: var(--dtv-color-text);
  word-break: break-word;
}

.dtv-inspector__row--error dd {
  color: var(--dtv-color-error);
}

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
  padding: var(--dtv-spacing-md);
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
</style>
