import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { usePersistence } from '@/composables/usePersistence'
import { useTokenSets } from '@/composables/useTokenSets'
import type { InputFile } from '@dtcg-mapper/core'

/**
 * usePersistence tests.
 *
 * Three layers exercised:
 *   1. `saveState`/`loadState` — round-trip through real `localStorage`
 *      (jsdom provides it), with structural and key-name assertions.
 *   2. Defensive paths — corrupt JSON, missing/wrong version, unavailable
 *      storage, quota errors. `loadState` returns null and never throws.
 *   3. `restoreFromStorage` — reuses `useTokenSets.addInputs`, so the
 *      restored sets run through the full pipeline (validate → resolve).
 *
 * Reset pattern: `useTokenSets` state lives at module scope, so each test
 * clears both slots and the storage key in `beforeEach`.
 */

/* -------------------------------------------------------------------------- */
/*  Constants                                                                */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'token-mapper:v1'

/** A small valid JSON token file used as set content. */
const A_JSON: InputFile = {
  name: 'a.json',
  content: '{"color":{"indigo":{"500":{"$type":"color","$value":"#6366f1"}}}}',
}
const B_JSON: InputFile = {
  name: 'b.json',
  content: '{"color":{"indigo":{"500":{"$type":"color","$value":"#4f46e5"}}}}',
}

/** Structural equality that ignores object key insertion order. */
function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEq(v, b[i]))
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    const ka = Object.keys(a as Record<string, unknown>)
    const kb = Object.keys(b as Record<string, unknown>)
    return (
      ka.length === kb.length &&
      ka.every(
        (k) =>
          Object.prototype.hasOwnProperty.call(b, k) &&
          deepEq(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k]
          )
      )
    )
  }
  return false
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                    */
/* -------------------------------------------------------------------------- */

describe('usePersistence', () => {
  const { setA, setB, addInputs, clearSet } = useTokenSets()
  const persistence = usePersistence()

  beforeEach(() => {
    clearSet('A')
    clearSet('B')
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /* -------------------------------------------------------------------- */
  /*  isPersistenceAvailable                                              */
  /* -------------------------------------------------------------------- */

  describe('isPersistenceAvailable', () => {
    it('returns true under jsdom (localStorage is present)', () => {
      expect(persistence.isPersistenceAvailable()).toBe(true)
    })

    it('returns false when localStorage throws on access (sandboxed iframe)', () => {
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
        expect(persistence.isPersistenceAvailable()).toBe(false)
      } finally {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    })
  })

  /* -------------------------------------------------------------------- */
  /*  saveState + loadState round-trip                                    */
  /* -------------------------------------------------------------------- */

  describe('saveState + loadState round-trip', () => {
    it('writes nothing when both slots are empty (no overwrite of prior data)', () => {
      // Seed storage with a prior session.
      const prior = JSON.stringify({
        version: 1,
        sets: { A: [{ name: 'prior.json', content: '{}' }] },
        savedAt: '2025-01-01T00:00:00.000Z',
      })
      localStorage.setItem(STORAGE_KEY, prior)
      // Now save with empty runtime state — the prior payload must survive.
      persistence.saveState()
      expect(localStorage.getItem(STORAGE_KEY)).toBe(prior)
    })

    it('persists set A and reads it back with version 1 and a non-empty savedAt', () => {
      addInputs('A', [A_JSON])
      persistence.saveState()
      const loaded = persistence.loadState()
      expect(loaded).not.toBeNull()
      expect(loaded!.version).toBe(1)
      expect(deepEq(loaded!.sets.A, [A_JSON])).toBe(true)
      expect(loaded!.sets.B).toBeUndefined()
      // savedAt must be a parseable ISO timestamp.
      const ts = new Date(loaded!.savedAt).getTime()
      expect(Number.isFinite(ts)).toBe(true)
    })

    it('persists both sets and reads them back', () => {
      addInputs('A', [A_JSON])
      addInputs('B', [B_JSON])
      persistence.saveState()
      const loaded = persistence.loadState()
      expect(loaded).not.toBeNull()
      expect(deepEq(loaded!.sets.A, [A_JSON])).toBe(true)
      expect(deepEq(loaded!.sets.B, [B_JSON])).toBe(true)
    })

    it('omits empty sides from the persisted payload', () => {
      addInputs('B', [B_JSON])
      persistence.saveState()
      const loaded = persistence.loadState()
      expect(loaded!.sets.A).toBeUndefined()
      expect(loaded!.sets.B).toBeDefined()
    })

    it('writes under the namespaced, versioned key', () => {
      addInputs('A', [A_JSON])
      persistence.saveState()
      // The raw key must be exactly 'token-mapper:v1' so future migrations
      // can locate it. Pinning the string guards against silent renames.
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
      // No other token-mapper keys should leak.
      const keys = Object.keys(localStorage)
      expect(keys).toEqual([STORAGE_KEY])
    })
  })

  /* -------------------------------------------------------------------- */
  /*  loadState defensive paths                                           */
  /* -------------------------------------------------------------------- */

  describe('loadState defensive paths', () => {
    it('returns null when the key is absent', () => {
      expect(persistence.loadState()).toBeNull()
    })

    it('returns null when the stored value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{ not json')
      expect(persistence.loadState()).toBeNull()
    })

    it('returns null when version is missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sets: {} }))
      expect(persistence.loadState()).toBeNull()
    })

    it('returns null when version is wrong (future format)', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 99, sets: {} })
      )
      expect(persistence.loadState()).toBeNull()
    })

    it('returns null when the stored value is a JSON primitive, not an object', () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"')
      expect(persistence.loadState()).toBeNull()
      localStorage.setItem(STORAGE_KEY, '42')
      expect(persistence.loadState()).toBeNull()
    })

    it('does not throw when localStorage.getItem raises (SecurityError)', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError')
      })
      expect(() => persistence.loadState()).not.toThrow()
      expect(persistence.loadState()).toBeNull()
      spy.mockRestore()
    })
  })

  /* -------------------------------------------------------------------- */
  /*  saveState defensive paths                                           */
  /* -------------------------------------------------------------------- */

  describe('saveState defensive paths', () => {
    it('does not throw when localStorage.setItem raises (QuotaExceededError)', () => {
      addInputs('A', [A_JSON])
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => persistence.saveState()).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
      warnSpy.mockRestore()
    })

    it('does not attempt a write when persistence is unavailable', () => {
      addInputs('A', [A_JSON])
      const spy = vi.spyOn(Storage.prototype, 'setItem')
      // Force isPersistenceAvailable to false by stubbing the global.
      const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('sandboxed')
        },
      })
      try {
        persistence.saveState()
        expect(spy).not.toHaveBeenCalled()
      } finally {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
      spy.mockRestore()
    })
  })

  /* -------------------------------------------------------------------- */
  /*  restoreFromStorage                                                  */
  /* -------------------------------------------------------------------- */

  describe('restoreFromStorage', () => {
    it('returns loaded "none" and leaves slots empty when storage is empty', () => {
      expect(persistence.restoreFromStorage()).toEqual({ loaded: 'none' })
      expect(setA.value).toBeNull()
      expect(setB.value).toBeNull()
    })

    it('returns loaded "none" when the payload decodes but has empty sets', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, sets: {}, savedAt: '2025-01-01T00:00:00.000Z' })
      )
      expect(persistence.restoreFromStorage()).toEqual({ loaded: 'none' })
    })

    it('restores set A and reports loaded "A"', () => {
      addInputs('A', [A_JSON])
      persistence.saveState()
      // Wipe runtime state to simulate a fresh page load.
      clearSet('A')
      expect(setA.value).toBeNull()
      // Restore — set A should reappear with the same source files.
      expect(persistence.restoreFromStorage()).toEqual({ loaded: 'A' })
      expect(setA.value).not.toBeNull()
      expect(setA.value?.sourceFiles).toEqual([A_JSON.name])
    })

    it('restores both sets and reports loaded "both"', () => {
      addInputs('A', [A_JSON])
      addInputs('B', [B_JSON])
      persistence.saveState()
      clearSet('A')
      clearSet('B')
      expect(persistence.restoreFromStorage()).toEqual({ loaded: 'both' })
      expect(setA.value?.sourceFiles).toEqual([A_JSON.name])
      expect(setB.value?.sourceFiles).toEqual([B_JSON.name])
    })

    it('runs the pipeline on restored inputs (resolved map is populated)', () => {
      addInputs('A', [A_JSON])
      persistence.saveState()
      clearSet('A')
      persistence.restoreFromStorage()
      // The fixture has color.indigo.500 — restore must go through addInputs
      // (which rebuilds via buildSet → validate → resolve), not just stash
      // the raw sources.
      expect(setA.value?.resolved.has('color.indigo.500')).toBe(true)
    })
  })

  /* -------------------------------------------------------------------- */
  /*  clearState                                                          */
  /* -------------------------------------------------------------------- */

  describe('clearState', () => {
    it('removes the persisted payload', () => {
      addInputs('A', [A_JSON])
      persistence.saveState()
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
      persistence.clearState()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('is a no-op when nothing is persisted', () => {
      expect(() => persistence.clearState()).not.toThrow()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('does not throw when localStorage.removeItem raises', () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('SecurityError')
      })
      expect(() => persistence.clearState()).not.toThrow()
      spy.mockRestore()
    })
  })
})
