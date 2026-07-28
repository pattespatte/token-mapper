import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useShare } from '@/composables/useShare'
import { useTokenSets } from '@/composables/useTokenSets'
import {
  encodeShare,
  decodeShare,
  MAX_SHARE_LENGTH,
  type ShareSnapshot,
} from '@/utils/shareCodec'
import type { InputFile } from '@dtcg-mapper/core'

/**
 * useShare tests.
 *
 * The composable bridges the pure share codec to the live `useTokenSets`
 * store and the browser URL/clipboard APIs. We exercise three layers:
 *
 *   1. `encodeCurrentState` — snapshot construction + length guard, fed by
 *      `useTokenSets.getSources` (the real singleton, reset between tests).
 *   2. `loadFromHash` — decode + `addInputs` round-trip back into the store.
 *   3. URL + clipboard — `writeToUrl`/`readFromUrl`/`copyShareLink`, against
 *      jsdom's `window.location.hash` and a polyfilled `navigator.clipboard`.
 *
 * Reset pattern: `useTokenSets` state lives at module scope, so each test
 * calls `clearSet('A'); clearSet('B')` in `beforeEach` to start clean.
 */

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

/** A small valid JSON token file used as set content in most tests. */
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
/*  Setup                                                                    */
/* -------------------------------------------------------------------------- */

describe('useShare', () => {
  const { setA, setB, addInputs, clearSet } = useTokenSets()
  const share = useShare()

  beforeEach(() => {
    clearSet('A')
    clearSet('B')
    // Reset location hash between tests so readFromUrl doesn't leak state.
    window.location.hash = ''
    // Polyfill navigator.clipboard (jsdom doesn't ship it). Each test can
    // override writeText if it wants to assert on the call.
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /* ---------------------------------------------------------------------- */
  /*  encodeCurrentState                                                    */
  /* ---------------------------------------------------------------------- */

  describe('encodeCurrentState', () => {
    it('returns reason "empty" when no sets are loaded', () => {
      expect(share.encodeCurrentState()).toEqual({ ok: false, reason: 'empty' })
    })

    it('returns ok with a hash after set A is loaded', () => {
      addInputs('A', [A_JSON])
      const result = share.encodeCurrentState()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(typeof result.hash).toBe('string')
        expect(result.hash.length).toBeGreaterThan(0)
      }
    })

    it('encodes a hash that round-trips both sets via decodeShare', () => {
      addInputs('A', [A_JSON])
      addInputs('B', [B_JSON])
      const result = share.encodeCurrentState()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // Decode via the pure codec to confirm the snapshot carries both sides.
      // (loadFromHash is exercised separately below.)
      const decoded = decodeShare(result.hash)
      expect(decoded).not.toBeNull()
      expect(deepEq(decoded!.sets.A, [A_JSON])).toBe(true)
      expect(deepEq(decoded!.sets.B, [B_JSON])).toBe(true)
    })

    it('omits empty sides from the snapshot', () => {
      addInputs('A', [A_JSON])
      const result = share.encodeCurrentState()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const decoded = decodeShare(result.hash)
      expect(decoded).not.toBeNull()
      expect(decoded!.sets.A).toBeDefined()
      // B is not loaded → must not appear in the snapshot at all.
      expect(decoded!.sets.B).toBeUndefined()
    })

    it('returns reason "too-large" when the encoded hash exceeds MAX_SHARE_LENGTH', () => {
      // Build a payload big enough that, even after gzip, the base64url form
      // tops MAX_SHARE_LENGTH chars. A *repeating* random string compresses
      // well (LZ77 finds the period), so we concatenate many distinct chunks
      // — each iteration seeds Math.random afresh, defeating the lookup.
      let bigRand = ''
      for (let i = 0; bigRand.length < 40_000; i++) {
        bigRand += Math.random().toString(36).slice(2) + i
      }
      addInputs('A', [{ name: 'big.json', content: bigRand }])
      // Sanity-check the fixture: the encoded form really does exceed the
      // limit, otherwise this test isn't exercising the guard.
      const rawEnc = encodeShare({
        version: 1,
        sets: { A: [{ name: 'big.json', content: bigRand }] },
      })
      expect(rawEnc.length).toBeGreaterThan(MAX_SHARE_LENGTH)
      const result = share.encodeCurrentState()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('too-large')
    })
  })

  /* ---------------------------------------------------------------------- */
  /*  loadFromHash                                                          */
  /* ---------------------------------------------------------------------- */

  describe('loadFromHash', () => {
    it('returns loaded "none" for a garbage hash and leaves slots empty', () => {
      const result = share.loadFromHash('!!!not-a-real-hash!!!')
      expect(result).toEqual({ loaded: 'none' })
      expect(setA.value).toBeNull()
      expect(setB.value).toBeNull()
    })

    it('returns loaded "none" for an empty string', () => {
      expect(share.loadFromHash('')).toEqual({ loaded: 'none' })
    })

    it('returns loaded "none" for a hash that decodes but has empty sets', () => {
      const empty: ShareSnapshot = { version: 1, sets: {} }
      const hash = encodeShare(empty)
      expect(share.loadFromHash(hash)).toEqual({ loaded: 'none' })
    })

    it('loads set A and reports loaded "A"', () => {
      const hash = encodeShare({ version: 1, sets: { A: [A_JSON] } })
      const result = share.loadFromHash(hash)
      expect(result).toEqual({ loaded: 'A' })
      expect(setA.value).not.toBeNull()
      expect(setA.value?.sourceFiles).toEqual([A_JSON.name])
      expect(setB.value).toBeNull()
    })

    it('loads set B only and reports loaded "B"', () => {
      const hash = encodeShare({ version: 1, sets: { B: [B_JSON] } })
      const result = share.loadFromHash(hash)
      expect(result).toEqual({ loaded: 'B' })
      expect(setB.value).not.toBeNull()
      expect(setA.value).toBeNull()
    })

    it('loads both sets and reports loaded "both"', () => {
      const hash = encodeShare({ version: 1, sets: { A: [A_JSON], B: [B_JSON] } })
      const result = share.loadFromHash(hash)
      expect(result).toEqual({ loaded: 'both' })
      expect(setA.value?.sourceFiles).toEqual([A_JSON.name])
      expect(setB.value?.sourceFiles).toEqual([B_JSON.name])
    })

    it('populates the resolved map (pipeline runs on the loaded inputs)', () => {
      // Confirms loadFromHash goes through addInputs (which rebuilds via
      // buildSet → validate → resolve), not just stashing raw sources.
      const hash = encodeShare({ version: 1, sets: { A: [A_JSON] } })
      share.loadFromHash(hash)
      expect(setA.value).not.toBeNull()
      // The fixture has color.indigo.500 — it must be in the resolved map.
      expect(setA.value?.resolved.has('color.indigo.500')).toBe(true)
    })
  })

  /* ---------------------------------------------------------------------- */
  /*  writeToUrl + readFromUrl                                              */
  /* ---------------------------------------------------------------------- */

  describe('writeToUrl + readFromUrl', () => {
    it('writeToUrl sets the hash; readFromUrl returns it without the leading #', () => {
      share.writeToUrl('abc123')
      expect(window.location.hash).toBe('#abc123')
      expect(share.readFromUrl()).toBe('abc123')
    })

    it('readFromUrl returns null when no hash is present', () => {
      window.location.hash = ''
      expect(share.readFromUrl()).toBeNull()
    })

    it('readFromUrl strips a leading #/ (history-mode hash)', () => {
      // Some routers write '#/path'; the codec's alphabet doesn't include '/'
      // so a real share hash will never legitimately start with '#/', but
      // the strip is defensive.
      window.location.hash = '#/abc'
      expect(share.readFromUrl()).toBe('abc')
    })

    it('writeToUrl overwrites any existing hash', () => {
      share.writeToUrl('first')
      share.writeToUrl('second')
      expect(share.readFromUrl()).toBe('second')
    })
  })

  /* ---------------------------------------------------------------------- */
  /*  copyShareLink                                                         */
  /* ---------------------------------------------------------------------- */

  describe('copyShareLink', () => {
    it('returns reason "empty" when nothing is loaded', async () => {
      await expect(share.copyShareLink()).resolves.toEqual({
        ok: false,
        reason: 'empty',
      })
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })

    it('writes the hash to the URL and copies the full URL on success', async () => {
      addInputs('A', [A_JSON])
      const result = await share.copyShareLink()
      expect(result).toEqual({ ok: true })
      // Hash is in the URL bar…
      expect(window.location.hash.length).toBeGreaterThan(1)
      // …and the full URL was sent to the clipboard (not just the hash).
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
      const copied = await (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.results[0]!.value
      expect(copied).toBeUndefined() // mock resolves undefined
      const arg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(arg).toContain(window.location.hash)
    })

    it('still writes the hash to the URL when clipboard rejects', async () => {
      addInputs('A', [A_JSON])
      ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('denied')
      )
      const result = await share.copyShareLink()
      expect(result).toEqual({ ok: false, reason: 'clipboard' })
      // Hash was written before the copy attempt — the user can copy manually.
      expect(window.location.hash.length).toBeGreaterThan(1)
    })

    it('returns reason "clipboard" when navigator.clipboard is unavailable', async () => {
      addInputs('A', [A_JSON])
      // Remove clipboard entirely (simulates insecure context / old browser).
      const original = navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      })
      try {
        const result = await share.copyShareLink()
        expect(result).toEqual({ ok: false, reason: 'clipboard' })
        // Hash still written before the failure.
        expect(window.location.hash.length).toBeGreaterThan(1)
      } finally {
        Object.defineProperty(navigator, 'clipboard', {
          value: original,
          configurable: true,
        })
      }
    })
  })
})
