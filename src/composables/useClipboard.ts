/**
 * useClipboard — copy-to-clipboard with a transient "copied!" signal.
 *
 * Extracted from the four components that previously duplicated this
 * pattern (TokenCard, Inspector, DiffCard, DiffInspector). Each component
 * gets its own `copied` ref + reset timer via `useClipboard()`; the
 * clipboard itself is a singleton browser API so nothing else is shared.
 *
 * Behaviour preserved exactly:
 *   - 1200ms reset of `copied` back to false after a successful copy.
 *   - Silent failure when `navigator.clipboard.writeText` rejects
 *     (permissions, insecure context) — `copied` stays false.
 *   - Calling `copy()` again while a reset is pending clears the previous
 *     timer so the latest copy gets a full 1200ms window.
 *
 * Callers register cleanup via `onUnmounted(cleanup)` if they care about
 * pending timers (the existing components do). The composable itself
 * doesn't register lifecycle hooks so it stays usable outside a component.
 */

import { ref, type Ref } from 'vue'

/** Reset delay in milliseconds; matches the original in-component pattern. */
const RESET_DELAY_MS = 1200

export function useClipboard(): {
  /** True for ~1.2s after a successful copy; bind to aria-label / button text. */
  copied: Ref<boolean>
  /** Copy text to the clipboard. Never throws; resolves even on failure. */
  copy: (text: string) => Promise<void>
  /** Clears any pending reset timer. Call from onUnmounted. */
  cleanup: () => void
} {
  const copied = ref(false)
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      if (copyResetTimer !== null) clearTimeout(copyResetTimer)
      copyResetTimer = setTimeout(() => {
        copied.value = false
        copyResetTimer = null
      }, RESET_DELAY_MS)
    } catch {
      // Clipboard may be unavailable (permissions, insecure context).
      // Fail silently — `copied` stays false so the UI doesn't lie.
    }
  }

  function cleanup(): void {
    if (copyResetTimer !== null) {
      clearTimeout(copyResetTimer)
      copyResetTimer = null
    }
  }

  return { copied, copy, cleanup }
}
