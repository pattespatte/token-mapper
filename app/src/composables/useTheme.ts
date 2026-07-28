/**
 * useTheme — whole-app theme mode toggle (light / dark / system).
 *
 * A user-controlled choice between three modes:
 *
 *   - `'light'`   → `<html data-theme="light">`  → light palette forced
 *   - `'dark'`    → `<html data-theme="dark">`   → dark palette forced
 *   - `'system'`  → no `data-theme` attribute    → follows the OS
 *                   `prefers-color-scheme` setting, live
 *
 * The two explicit choices override the OS preference. The `'system'` mode
 * hands control back to the browser: `App.vue` *deletes* the `data-theme`
 * attribute, so the `@media (prefers-color-scheme: dark)` branch in
 * `tokens.css` governs — and re-evaluates automatically when the OS theme
 * changes, with no JS listener required.
 *
 * The toggle cycles `light → dark → system → light` (wraps). New visitors
 * default to `'system'`, so a fresh install matches the OS from the first
 * paint (before JS runs, the attribute is absent and the CSS media query
 * already applies — no flash of the wrong palette).
 *
 * Persistence: the choice is stored under `localStorage['token-mapper:theme']`
 * as the raw mode string (no JSON). Like `usePersistence`, all storage access
 * is feature-detected and try/caught — the composable never throws and works
 * in environments without `localStorage`.
 *
 * Side-effect policy: the composable does **not** write to
 * `document.documentElement` itself. `App.vue` calls `initThemeFromStorage()`
 * once on mount and owns the `data-theme` attribute write/delete, so the DOM
 * touch-point lives in one auditable place.
 */

import { ref, type Ref } from 'vue'

/** Order the toggle cycles through. Index wraps with modulo. */
const CYCLE: readonly Theme[] = ['light', 'dark', 'system']

/** The three whole-app theme modes. Defaults to `'system'` on first load. */
export type Theme = 'light' | 'dark' | 'system'

/** localStorage key. Namespaced; not versioned. */
const STORAGE_KEY = 'token-mapper:theme'

/** Module-scoped singleton state — every caller sees the same theme. */
const theme: Ref<Theme> = ref('system')

/** Modes considered valid when read back from storage. */
const VALID_THEMES: readonly Theme[] = ['light', 'dark', 'system']

export function useTheme() {
  /**
   * Set the theme and persist the choice. Persistence failures (private
   * mode, disabled storage) are swallowed — the runtime state still updates.
   */
  function setTheme(next: Theme): void {
    theme.value = next
    writeStorage(next)
  }

  /**
   * Advance one step through `light → dark → system → light`. Wraps with
   * modulo on the {@link CYCLE} so it stays correct if the order ever changes.
   */
  function toggleTheme(): void {
    const next = CYCLE[(CYCLE.indexOf(theme.value) + 1) % CYCLE.length]!
    setTheme(next)
  }

  /**
   * Read the persisted theme from storage into the runtime ref. Called once
   * on app mount by `App.vue`. Falls back to the current ref value (default
   * `'system'`) when storage is empty, corrupt, or holds an unknown value —
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
   * unavailable, the key is absent, or the stored value isn't one of the
   * known modes (`'light'`, `'dark'`, `'system'`). Never throws.
   */
  function readStorage(): Theme | null {
    if (!isStorageAvailable()) return null
    let raw: string | null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
    if (VALID_THEMES.includes(raw as Theme)) return raw as Theme
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
