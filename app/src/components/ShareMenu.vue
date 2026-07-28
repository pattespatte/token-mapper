<script setup lang="ts">
/**
 * ShareMenu — share-link controls for the loaded token sets.
 *
 * Three sibling buttons in a flat row (matches ExportMenu's "no dropdown"
 * convention — simpler and more discoverable than a collapsed menu):
 *
 *   - Copy link → encode sets, write hash to URL, copy URL to clipboard
 *   - Open in tab → encode, write hash, open the URL in a new tab
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
 * Transient feedback (success / clipboard-failed / popup-blocked) auto-clears
 * after ~1.5s via a single shared timer.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useShare } from '@/composables/useShare'

const { encodeCurrentState, writeToUrl, copyShareLink } = useShare()

const COPY_FEEDBACK_MS = 1500
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

/**
 * The single source of truth for what message to show. One value at a time;
 * setting a new one clears the prior. Cleared automatically after the timeout.
 */
type Message =
  | { kind: 'copied' }
  | { kind: 'clipboard-failed' }
  | { kind: 'popup-blocked' }
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

/**
 * "Open in new tab": encode → write to URL → `window.open(href, '_blank')`.
 * Popup blockers cause `window.open` to return null; the link is in the URL
 * bar either way.
 */
function onOpenInTab(): void {
  const enc = encodeCurrentState()
  if (!enc.ok) {
    setMessage({ kind: enc.reason })
    return
  }
  writeToUrl(enc.hash)
  refreshHashPresence()
  if (typeof window === 'undefined') return
  const win = window.open(window.location.href, '_blank', 'noopener')
  if (win === null) {
    setMessage({ kind: 'popup-blocked' })
  }
  // No success message on open-in-tab success: the new tab opening is the
  // feedback. Showing "✓ Link copied" would be misleading (nothing copied).
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
    case 'popup-blocked': return 'Popup blocked — link is in the address bar'
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
  <div class="dtv-share-menu" role="group" aria-label="Share loaded token sets">
    <button
      type="button"
      class="dtv-share-menu__button dtv-share-menu__button--primary"
      @click="onCopyLink"
    >
      Copy link
    </button>
    <button
      type="button"
      class="dtv-share-menu__button"
      @click="onOpenInTab"
    >
      Open in tab
    </button>
    <button
      type="button"
      class="dtv-share-menu__button"
      :disabled="!hasHashInUrl"
      @click="onClearUrl"
    >
      Clear URL
    </button>
    <span
      v-if="message !== null"
      class="dtv-share-menu__message"
      :class="{
        'dtv-share-menu__message--success': isSuccess,
        'dtv-share-menu__message--error': isError,
      }"
      role="status"
      aria-live="polite"
    >
      {{ messageText }}
    </span>
  </div>
</template>

<style scoped>
.dtv-share-menu {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  align-items: center;
}

.dtv-share-menu__button {
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
  cursor: pointer;
}

.dtv-share-menu__button:hover:not(:disabled):not(.dtv-share-menu__button--primary) {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1). */
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface-muted);
}

.dtv-share-menu__button:focus-visible {
  outline: 2px solid var(--dtv-color-accent);
  outline-offset: 2px;
}

.dtv-share-menu__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary "Copy link" gets the accent treatment so the most-common action
   stands out from the two secondary buttons (mirrors ExportMenu). */
.dtv-share-menu__button--primary {
  color: var(--dtv-color-bg);
  background-color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-share-menu__button--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.dtv-share-menu__message {
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}

.dtv-share-menu__message--success {
  color: var(--dtv-color-success);
}

.dtv-share-menu__message--error {
  color: var(--dtv-color-warning);
}
</style>
