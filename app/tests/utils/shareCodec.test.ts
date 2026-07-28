import { describe, expect, it } from 'vitest'
import { gzip } from 'pako'
import {
  encodeShare,
  decodeShare,
  MAX_SHARE_LENGTH,
  type ShareSnapshot,
} from '@/utils/shareCodec'
import type { InputFile } from '@dtcg-mapper/core'

/**
 * shareCodec tests.
 *
 * The codec converts a {@link ShareSnapshot} into a compact base64url string
 * and back. These tests pin three properties:
 *
 *   1. **Round-trip correctness** — every well-formed snapshot survives an
 *      encode → decode cycle structurally intact.
 *   2. **Deterministic output** — identical snapshots produce byte-identical
 *      encoded strings (so two clients encoding the same state produce the
 *      same shareable URL).
 *   3. **Defensive decoding** — `decodeShare` returns `null` (never throws)
 *      on every plausible corruption path: truncated strings, non-alphabet
 *      characters, corrupt gzip headers, invalid JSON, and wrong/missing
 *      `version` fields.
 *
 * Mirrors the helper style of `tests/composables/useSearch.test.ts`. The
 * codec is pure (no Vue, no browser globals), so no jsdom setup is needed —
 * tests import directly and assert.
 */

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

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

/** Build a snapshot with both sides populated, mixing JSON + CSS inputs. */
function bothSetsSnapshot(): ShareSnapshot {
  const A: InputFile[] = [
    { name: 'foundation.json', content: '{"color":{"indigo":{"500":{"$type":"color","$value":"#6366f1"}}}}' },
  ]
  const B: InputFile[] = [
    { name: 'base.css', content: ':root { --color-indigo-500: #6366f1; }' },
  ]
  return { version: 1, sets: { A, B }, label: 'demo' }
}

/**
 * Synthesise an encoded share payload from an arbitrary JSON string, bypassing
 * the `encodeShare` validator. Used to feed `decodeShare` payloads that the
 * public encoder could never produce (wrong version, non-object JSON, etc.)
 * so we can test the decoder's rejection paths strictly.
 *
 * Mirrors what `encodeShare` does internally: gzip the JSON, base64url-encode.
 * We re-implement the base64url step with Node's `Buffer` rather than the
 * codec's internal helper, so a bug in the codec's own base64url code can't
 * mask a decoder bug.
 */
function synthFromJson(json: string): string {
  const compressed = gzip(new TextEncoder().encode(json))
  // Buffer.base64url is available in Node 16+ and in vitest's jsdom env.
  return Buffer.from(compressed).toString('base64url')
}

/* -------------------------------------------------------------------------- */
/*  Round-trip correctness                                                   */
/* -------------------------------------------------------------------------- */

describe('encodeShare → decodeShare round-trip', () => {
  it('round-trips a single-set JSON snapshot', () => {
    const snap: ShareSnapshot = {
      version: 1,
      sets: { A: [{ name: 'a.json', content: '{"x":{"$type":"color","$value":"#fff"}}' }] },
    }
    expect(deepEq(decodeShare(encodeShare(snap)), snap)).toBe(true)
  })

  it('round-trips both sets with mixed JSON + CSS inputs', () => {
    const snap = bothSetsSnapshot()
    expect(deepEq(decodeShare(encodeShare(snap)), snap)).toBe(true)
  })

  it('round-trips an empty snapshot (no sets loaded)', () => {
    const snap: ShareSnapshot = { version: 1, sets: {} }
    expect(deepEq(decodeShare(encodeShare(snap)), snap)).toBe(true)
  })

  it('round-trips a snapshot with only set B loaded', () => {
    const snap: ShareSnapshot = {
      version: 1,
      sets: { B: [{ name: 'only.css', content: ':root{--x:#fff}' }] },
    }
    expect(deepEq(decodeShare(encodeShare(snap)), snap)).toBe(true)
  })

  it('round-trips snapshots whose compressed length crosses the base64 padding boundaries', () => {
    // The base64url encoder strips 0, 1, or 2 trailing chars depending on
    // byte length mod 3. Hit all three cases by varying content length.
    const lengths = [1, 2, 3, 4, 5, 6, 7]
    for (const n of lengths) {
      const snap: ShareSnapshot = {
        version: 1,
        sets: { A: [{ name: 'a.json', content: 'X'.repeat(n) }] },
      }
      expect(deepEq(decodeShare(encodeShare(snap)), snap), `content length ${n}`).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/*  Deterministic output                                                     */
/* -------------------------------------------------------------------------- */

describe('encodeShare determinism', () => {
  it('produces byte-identical output for identical snapshots', () => {
    const snap = bothSetsSnapshot()
    expect(encodeShare(snap)).toBe(encodeShare(snap))
  })

  it('produces identical output regardless of top-level key insertion order', () => {
    // Construct two equivalent snapshots with differently-ordered top-level
    // keys. The stable serializer must normalise them to the same bytes.
    const a: ShareSnapshot = { version: 1, sets: { A: [{ name: 'x.json', content: '{}' }] } }
    const b = { sets: { A: [{ name: 'x.json', content: '{}' }] }, version: 1 } as ShareSnapshot
    expect(encodeShare(a)).toBe(encodeShare(b))
  })

  it('produces identical output regardless of nested set key order', () => {
    const a: ShareSnapshot = {
      version: 1,
      sets: { A: [{ name: 'a.json', content: '{}' }], B: [{ name: 'b.json', content: '{}' }] },
    }
    const b: ShareSnapshot = {
      version: 1,
      sets: { B: [{ name: 'b.json', content: '{}' }], A: [{ name: 'a.json', content: '{}' }] },
    }
    expect(encodeShare(a)).toBe(encodeShare(b))
  })
})

/* -------------------------------------------------------------------------- */
/*  Defensive decoding                                                       */
/* -------------------------------------------------------------------------- */

describe('decodeShare defensive paths', () => {
  it('returns null for an empty string', () => {
    expect(decodeShare('')).toBeNull()
  })

  it('returns null for input containing non-base64url characters', () => {
    expect(decodeShare('!!!not-base64!!!')).toBeNull()
  })

  it('returns null for input containing standard-base64 characters (+/=)', () => {
    // base64url forbids '+', '/', and '=' padding — they must be rejected
    // so a caller can't accidentally pass a standard-base64 string through.
    expect(decodeShare('ab+cdef')).toBeNull()
    expect(decodeShare('ab/cdef')).toBeNull()
    expect(decodeShare('abcdef=')).toBeNull()
  })

  it('returns null for a truncated valid payload', () => {
    const enc = encodeShare(bothSetsSnapshot())
    // Strip enough to corrupt the final quartet + gzip trailer.
    expect(decodeShare(enc.slice(0, -8))).toBeNull()
  })

  it('returns null for valid base64url that is not valid gzip', () => {
    // 64 zero-bits encoded as base64url — valid alphabet, bogus gzip header.
    expect(decodeShare('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
  })

  it('returns null when the decompressed payload is not valid JSON', () => {
    // Gunzips to "{ not json" — valid gzip, invalid JSON.
    expect(decodeShare(synthFromJson('{ not json'))).toBeNull()
  })

  it('returns null for valid JSON with the wrong version field', () => {
    // `encodeShare` always writes `version: 1`; a payload claiming `99`
    // must be rejected so a future `version: 2` format isn't silently
    // mis-parsed as v1.
    expect(decodeShare(synthFromJson('{"version":99,"sets":{}}'))).toBeNull()
  })

  it('returns null for valid JSON with a missing version field', () => {
    expect(decodeShare(synthFromJson('{"sets":{}}'))).toBeNull()
  })

  it('returns null for valid JSON that is not an object', () => {
    // A bare string or number is valid JSON but not a snapshot.
    expect(decodeShare(synthFromJson('"just a string"'))).toBeNull()
    expect(decodeShare(synthFromJson('42'))).toBeNull()
    expect(decodeShare(synthFromJson('null'))).toBeNull()
  })

  it('returns null for valid JSON with a non-numeric version', () => {
    // Defensive: `version` must be exactly the number `1`, not a string.
    expect(decodeShare(synthFromJson('{"version":"1","sets":{}}'))).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  Size constant                                                            */
/* -------------------------------------------------------------------------- */

describe('MAX_SHARE_LENGTH', () => {
  it('is exactly 32 000 characters', () => {
    // Pinned value — callers (useShare) compare encoded length against this
    // before stuffing it into a URL. Changing it silently changes the share
    // UX, so the constant must move deliberately.
    expect(MAX_SHARE_LENGTH).toBe(32_000)
  })
})

/* -------------------------------------------------------------------------- */
/*  Large input handling                                                     */
/* -------------------------------------------------------------------------- */

describe('large inputs', () => {
  it('encodeShare does not throw for a ~30 KB payload', () => {
    // The codec is length-agnostic by design; size limiting is the caller's
    // job (see useShare). This test pins that contract: a payload near the
    // documented MAX_SHARE_LENGTH ceiling must encode without error.
    const bigContent = 'X'.repeat(30_000)
    const snap: ShareSnapshot = {
      version: 1,
      sets: { A: [{ name: 'big.json', content: bigContent }] },
    }
    expect(() => encodeShare(snap)).not.toThrow()
  })

  it('round-trips a payload whose compressed form approaches the URL limit', () => {
    // gzip compresses repetitive content very well, so a 30 KB 'X' payload
    // encodes to well under 200 chars. Use higher-entropy content to push
    // the encoded length up while staying under MAX_SHARE_LENGTH.
    const entropy = Math.random().toString(36).slice(2).repeat(2000)
    const snap: ShareSnapshot = {
      version: 1,
      sets: { A: [{ name: 'rand.json', content: entropy }] },
    }
    const enc = encodeShare(snap)
    expect(enc.length).toBeLessThan(MAX_SHARE_LENGTH)
    expect(deepEq(decodeShare(enc), snap)).toBe(true)
  })
})
