<script setup lang="ts">
/**
 * ShareMenu — share-link controls for the loaded token sets.
 *
 * Two sibling buttons in a flat row (matches ExportMenu's "no dropdown"
 * convention — simpler and more discoverable than a collapsed menu). Each
 * carries a leading outlined icon; both buttons share the same surface
 * styling (no primary/accent variant) — the icon differentiates the action.
 *
 *   - Copy link → encode sets, write hash to URL, copy URL to clipboard
 *   - Clear URL → strip the hash via history.replaceState
 *
 * Reads `useShare` (which in turn reads `useTokenSets`) for state. Inline
 * status messages mirror ExportMenu's "✓ Copied" pattern — no global toast
 * system exists.
 *
 * Empty / too-large guards: the encode step can fail with `'empty'` (no sets
 * loaded) or `'too-large'` (encoded hash exceeds `MAX_SHARE_LENGTH`). Each
 * failure gets a specific inline note; the buttons stay enabled so the user
 * can retry after loading more (or fewer) files.
 *
 * Transient feedback (success / clipboard-failed) auto-clears after ~1.5s
 * via a single shared timer.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useShare } from '@/composables/useShare'

const { copyShareLink } = useShare()

const COPY_FEEDBACK_MS = 1500
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

/**
 * The single source of truth for what message to show. One value at a time;
 * setting a new one clears the prior. Cleared automatically after the timeout.
 */
type Message =
  | { kind: 'copied' }
  | { kind: 'clipboard-failed' }
  | { kind: 'empty' }
  | { kind: 'too-large' }

const message = ref<Message | null>(null)

/** True if the URL currently has a non-empty hash (gates the Clear button). */
const hasHashInUrl = ref(false)

/** Set the message and start the auto-clear timer (cancels any prior). */
function setMessage(next: Message): void {
  message.value = next
  if (feedbackTimer !== null) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    message.value = null
    feedbackTimer = null
  }, COPY_FEEDBACK_MS)
}

/** Read the live `window.location.hash` presence into `hasHashInUrl`. */
function refreshHashPresence(): void {
  if (typeof window === 'undefined') return
  hasHashInUrl.value = window.location.hash !== ''
}

/**
 * "Copy link": encode → write to URL → copy URL to clipboard. The hash is
 * written *before* the clipboard copy so that even on clipboard failure the
 * link is in the address bar.
 */
async function onCopyLink(): Promise<void> {
  const result = await copyShareLink()
  refreshHashPresence()
  if (result.ok) {
    setMessage({ kind: 'copied' })
  } else if (result.reason === 'clipboard') {
    setMessage({ kind: 'clipboard-failed' })
  } else {
    // 'empty' or 'too-large' — encode-side failure.
    setMessage({ kind: result.reason })
  }
}

/** "Clear URL": strip the hash via `history.replaceState`. */
function onClearUrl(): void {
  if (typeof window === 'undefined') return
  if (window.location.hash === '') return
  history.replaceState(null, '', window.location.pathname + window.location.search)
  refreshHashPresence()
  // Clear any pending message — the URL being clean is the feedback.
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  message.value = null
}

/** Human-facing string for the current message. Empty when message is null. */
const messageText = computed<string>(() => {
  switch (message.value?.kind) {
    case 'copied': return '✓ Link copied'
    case 'clipboard-failed': return "Couldn't copy — link is in the address bar"
    case 'empty': return 'Load a set first'
    case 'too-large': return 'Sets too large for a URL — use export instead'
    default: return ''
  }
})

/** True when the message represents a success state (for green styling). */
const isSuccess = computed(() => message.value?.kind === 'copied')

/** True when the message represents an encode failure (for warning styling). */
const isError = computed(
  () => message.value?.kind === 'empty' || message.value?.kind === 'too-large'
)

onMounted(() => {
  refreshHashPresence()
})

onUnmounted(() => {
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
})
</script>

<template>
  <div class="dtm-share-menu" role="group" aria-label="Share loaded token sets">
    <button
      type="button"
      class="dtm-share-menu__button"
      @click="onCopyLink"
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      Copy link
    </button>
    <button
      type="button"
      class="dtm-share-menu__button"
      :disabled="!hasHashInUrl"
      @click="onClearUrl"
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Eraser: clears the hash from the URL -->
        <path d="M20 20H7L3 16c-.78-.78-.78-2.05 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0l5.83 5.83a2 2 0 0 1 0 2.83L13 20" />
        <line x1="18" y1="12" x2="9" y2="21" />
      </svg>
      Clear URL
    </button>
    <span
      v-if="message !== null"
      class="dtm-share-menu__message"
      :class="{
        'dtm-share-menu__message--success': isSuccess,
        'dtm-share-menu__message--error': isError,
      }"
      role="status"
      aria-live="polite"
    >
      {{ messageText }}
    </span>
  </div>
</template>

<style scoped>
.dtm-share-menu {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--dtm-spacing-xs);
  align-items: center;
}

.dtm-share-menu__button {
  display: inline-flex;
  align-items: center;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-medium);
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface);
  border: 1px solid var(--dtm-color-border-strong);
  border-radius: var(--dtm-radius-md);
  cursor: pointer;
}

.dtm-share-menu__button:hover:not(:disabled) {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1). */
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-share-menu__button:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: 2px;
}

.dtm-share-menu__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dtm-share-menu__message {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}

.dtm-share-menu__message--success {
  color: var(--dtm-color-success);
}

.dtm-share-menu__message--error {
  color: var(--dtm-color-warning);
}
</style>
