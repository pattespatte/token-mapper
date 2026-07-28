import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useTheme } from '@/composables/useTheme'

/**
 * useTheme tests.
 *
 * Three layers exercised:
 *   1. State transitions — `setTheme`/`toggleTheme` flip the ref correctly.
 *   2. Persistence — choices round-trip through real `localStorage` (jsdom).
 *   3. Defensive paths — empty/corrupt/unknown stored values fall back to
 *      the default without throwing; unavailable storage degrades silently.
 *
 * Singleton caveat: `theme` is module-scoped, so test order leaks across
 * cases unless we explicitly reset. Each test resets to 'system' and clears
 * localStorage in `beforeEach`.
 */

const STORAGE_KEY = 'token-mapper:theme'

describe('useTheme', () => {
  const { theme, setTheme, toggleTheme, initThemeFromStorage } = useTheme()

  beforeEach(() => {
    // Reset singleton state to the documented default, then wipe storage so
    // each test starts from a clean persistence state. Order matters:
    // setTheme('system') writes 'system' to localStorage as a side-effect, so
    // the clear() must come AFTER to leave storage empty for tests that
    // need to assert on absence.
    setTheme('system')
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /* -------------------------------------------------------------------- */
  /*  Default state                                                       */
  /* -------------------------------------------------------------------- */

  describe('default state', () => {
    it('defaults to "system" on first import', () => {
      // The module-scoped ref initialises to 'system' regardless of any
      // prior localStorage state — initThemeFromStorage is what applies
      // stored state, and it must be called explicitly.
      expect(theme.value).toBe('system')
    })
  })

  /* -------------------------------------------------------------------- */
  /*  State transitions                                                   */
  /* -------------------------------------------------------------------- */

  describe('setTheme + toggleTheme', () => {
    it('setTheme updates the ref to the given value', () => {
      setTheme('dark')
      expect(theme.value).toBe('dark')
      setTheme('light')
      expect(theme.value).toBe('light')
    })

    it('toggleTheme cycles light → dark → system → light', () => {
      setTheme('light')
      expect(theme.value).toBe('light')
      toggleTheme()
      expect(theme.value).toBe('dark')
      toggleTheme()
      expect(theme.value).toBe('system')
      toggleTheme()
      // Wraps back to the start of the cycle.
      expect(theme.value).toBe('light')
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Persistence                                                         */
  /* -------------------------------------------------------------------- */

  describe('persistence', () => {
    it('setTheme writes the choice to localStorage', () => {
      setTheme('dark')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
      setTheme('system')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('system')
    })

    it('writes under the namespaced key only', () => {
      setTheme('dark')
      const keys = Object.keys(localStorage).sort()
      expect(keys).toEqual([STORAGE_KEY])
    })

    it('initThemeFromStorage restores the persisted theme into the ref', () => {
      // Simulate a fresh page load: storage has 'dark', ref starts at default.
      localStorage.setItem(STORAGE_KEY, 'dark')
      // setTheme('system') ran in beforeEach, so the ref currently disagrees
      // with storage — exactly the state initThemeFromStorage resolves.
      expect(theme.value).toBe('system')
      initThemeFromStorage()
      expect(theme.value).toBe('dark')
    })

    it('initThemeFromStorage restores "system" too', () => {
      // Put the ref in a known non-system state. setTheme persists as a side
      // effect, so the storage write must come AFTER it (otherwise 'dark'
      // would overwrite 'system').
      setTheme('dark')
      expect(theme.value).toBe('dark')
      localStorage.setItem(STORAGE_KEY, 'system')
      initThemeFromStorage()
      expect(theme.value).toBe('system')
    })

    it('initThemeFromStorage leaves the ref unchanged when storage is empty', () => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(theme.value).toBe('system')
      initThemeFromStorage()
      expect(theme.value).toBe('system')
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Defensive paths                                                     */
  /* -------------------------------------------------------------------- */

  describe('defensive paths', () => {
    it('initThemeFromStorage ignores an unknown stored value (no "green")', () => {
      localStorage.setItem(STORAGE_KEY, 'green')
      initThemeFromStorage()
      // Unknown values must not corrupt the ref — silently keep the default.
      expect(theme.value).toBe('system')
    })

    it('initThemeFromStorage ignores corrupt (non-string) stored JSON', () => {
      // The validator only accepts the literal strings 'light' | 'dark' | 'system'.
      // A JSON-encoded object must be rejected, not parsed.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'dark' }))
      initThemeFromStorage()
      expect(theme.value).toBe('system')
    })

    it('setTheme does not throw when localStorage.setItem raises', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      expect(() => setTheme('dark')).not.toThrow()
      // Runtime state still updates even if persistence failed.
      expect(theme.value).toBe('dark')
      spy.mockRestore()
    })

    it('initThemeFromStorage does not throw when localStorage.getItem raises', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError')
      })
      expect(() => initThemeFromStorage()).not.toThrow()
      expect(theme.value).toBe('system')
      spy.mockRestore()
    })

    it('degrades silently when localStorage is unavailable (sandboxed iframe)', () => {
      // Spoof the getter to throw, simulating a sandboxed cross-origin iframe
      // where even reading `window.localStorage` denies access.
      const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('sandboxed')
        },
      })
      try {
        expect(() => setTheme('dark')).not.toThrow()
        expect(() => initThemeFromStorage()).not.toThrow()
      } finally {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    })
  })
})
