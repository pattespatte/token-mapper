/**
 * useTheme — whole-app light/dark theme toggle.
 *
 * A user-controlled choice between light and dark UI, overriding the OS
 * `prefers-color-scheme` setting. The choice drives the `data-theme`
 * attribute on `<html>`, which `tokens.css` consumes to swap the full
 * `--dtv-color-*` palette (backgrounds, surfaces, text, borders, accents).
 *
 * Override semantics:
 *   - `theme === 'light'`  → `<html data-theme="light">`  → light palette forced
 *   - `theme === 'dark'`   → `<html data-theme="dark">`   → dark palette forced
 *
 * The OS preference is honoured only when the user hasn't picked (i.e. on
 * the very first visit, before the toggle has been clicked). See
 * `tokens.css` for the cascade that implements this.
 *
 * Persistence: the choice is stored under `localStorage['token-mapper:theme']`
 * so it survives reloads. Like `usePersistence`, all storage access is
 * feature-detected and try/caught — the composable never throws and works
 * in environments without `localStorage`.
 *
 * Side-effect policy: the composable does **not** write to
 * `document.documentElement` itself. `App.vue` calls `initThemeFromStorage()`
 * once on mount and owns the `data-theme` attribute write, so the DOM
 * touch-point lives in one auditable place.
 */

import { ref, type Ref } from 'vue'

/** The two whole-app themes. Defaults to `'light'` on first load. */
export type Theme = 'light' | 'dark'

/** localStorage key. Namespaced; not versioned (an 'auto' option would be additive). */
const STORAGE_KEY = 'token-mapper:theme'

/** Module-scoped singleton state — every caller sees the same theme. */
const theme: Ref<Theme> = ref('light')

export function useTheme() {
  /**
   * Set the theme and persist the choice. Persistence failures (private
   * mode, disabled storage) are swallowed — the runtime state still updates.
   */
  function setTheme(next: Theme): void {
    theme.value = next
    writeStorage(next)
  }

  /** Flip between light and dark. */
  function toggleTheme(): void {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  /**
   * Read the persisted theme from storage into the runtime ref. Called once
   * on app mount by `App.vue`. Falls back to the current ref value (default
   * `'light'`) when storage is empty, corrupt, or holds an unknown value —
   * never throws, never sets an invalid theme.
   */
  function initThemeFromStorage(): void {
    const stored = readStorage()
    if (stored !== null) theme.value = stored
  }

  /**
   * Write the theme to localStorage. No-op outside the browser or when
   * storage is unavailable. Swallows all errors (private mode, quota, sandbox).
   */
  function writeStorage(value: Theme): void {
    if (!isStorageAvailable()) return
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // No-op — see usePersistence for the rationale.
    }
  }

  /**
   * Read and validate the stored theme. Returns `null` when storage is
   * unavailable, the key is absent, or the stored value isn't `'light'` or
   * `'dark'`. Never throws.
   */
  function readStorage(): Theme | null {
    if (!isStorageAvailable()) return null
    let raw: string | null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
    if (raw === 'light' || raw === 'dark') return raw
    return null
  }

  /** Feature-detect `localStorage`. Mirrors `usePersistence.isPersistenceAvailable`. */
  function isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false
    if (!('localStorage' in window)) return false
    try {
      return window.localStorage !== null
    } catch {
      return false
    }
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    initThemeFromStorage,
  }
}
