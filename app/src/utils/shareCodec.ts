/**
 * shareCodec — pure URL-hash encoder/decoder for token-set sharing.
 *
 * Converts a {@link ShareSnapshot} into a compact base64url string (and back)
 * so the app can encode token sets into a URL fragment for sharing.
 *
 * Purity contract: zero browser API usage (no `window`, no `document`,
 * no `btoa`). The only external dependency is `pako` for gzip compression.
 * This makes the codec unit-testable in Node and (optionally) extractable to
 * `@dtcg-mapper/core` in a future tier.
 *
 * Size guard: callers must check the encoded length against
 * {@link MAX_SHARE_LENGTH} before stuffing it into a URL. The codec itself
 * does not enforce limits — it is a pure transformation.
 */

import { gzip, inflate } from 'pako'
import type { InputFile } from '@dtcg-mapper/core'

/* -------------------------------------------------------------------------- */
/*  Types                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Versioned snapshot of the token-set state to be shared.
 *
 * `version` exists so future format changes can be detected during decode
 * without breaking old links (add a `version: 2` decoder branch later).
 */
export interface ShareSnapshot {
  version: 1
  sets: {
    A?: InputFile[]
    B?: InputFile[]
  }
  label?: string
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Maximum allowed length (in characters) for a URL-hash payload.
 *
 * Browsers tolerate very long URLs (>2 MB), but some intermediaries
 * (proxies, Slack/Teams link previews, email clients) truncate around
 * 2 000–8 000 characters. We pick 32 000 as a generous ceiling that works
 * in most share channels while still fitting real-world token sets.
 */
export const MAX_SHARE_LENGTH = 32_000

/* -------------------------------------------------------------------------- */
/*  Base64url helpers (no btoa — works in both browser and Node)            */
/* -------------------------------------------------------------------------- */

/** RFC 4648 base64url alphabet (no `+`, `/`, `=` padding). */
const B64URL_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * Lookup table: char code → 6-bit index. Built once at module load.
 * `Map` (not a plain object) so char codes above 127 don't collide.
 */
const B64URL_LUT: ReadonlyMap<number, number> = (() => {
  const lut = new Map<number, number>()
  for (let i = 0; i < B64URL_CHARS.length; i++) {
    lut.set(B64URL_CHARS.charCodeAt(i), i)
  }
  return lut
})()

/** Encode a `Uint8Array` to a base64url string (no padding). */
function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  let result = ''
  for (let i = 0; i < binary.length; i += 3) {
    // charCodeAt returns 0 for out-of-range indices, which is exactly the
    // "pad with zero bytes" behaviour we want for the trailing trio.
    const trio =
      (binary.charCodeAt(i) << 16) |
      (binary.charCodeAt(i + 1) << 8) |
      binary.charCodeAt(i + 2)
    // Indices are masked into [0, 63], so the array access is total — use
    // non-null assertions to satisfy noUncheckedIndexedAccess without a runtime
    // guard that could never fire.
    result +=
      B64URL_CHARS[(trio >>> 18) & 0x3f]! +
      B64URL_CHARS[(trio >>> 12) & 0x3f]! +
      B64URL_CHARS[(trio >>> 6) & 0x3f]! +
      B64URL_CHARS[trio & 0x3f]!
  }
  // Strip the trailing padding characters that correspond to the zero bytes
  // we injected for incomplete quartets. The padding length is determined
  // by the original byte length mod 3.
  const pad = binary.length % 3
  if (pad === 1) result = result.slice(0, -2)
  else if (pad === 2) result = result.slice(0, -1)
  return result
}

/** Decode a base64url string back to a `Uint8Array`. */
function base64UrlToUint8(str: string): Uint8Array | null {
  // Fast reject: must only contain the base64url alphabet (no '=' padding).
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return null

  // Pad with 'A' (alphabet index 0) to a multiple of 4. Standard base64 pads
  // with '=', but '=' isn't in the base64url alphabet — padding with the
  // zero-bit character produces identical decoded bytes for the leading
  // quartets while letting the alphabet check stay strict.
  const pad = str.length % 4
  const padded = pad > 0 ? str + 'A'.repeat(4 - pad) : str

  // Drop the trailing 1-2 bytes that the injected padding would otherwise
  // emit. The original (pre-pad) length tells us exactly how many real bytes
  // the final quartet contributes.
  const realLenInFinalQuartet = pad === 0 ? 3 : pad - 1
  const bytes: number[] = []
  for (let i = 0; i < padded.length; i += 4) {
    const a = B64URL_LUT.get(padded.charCodeAt(i))
    const b = B64URL_LUT.get(padded.charCodeAt(i + 1))
    const c = B64URL_LUT.get(padded.charCodeAt(i + 2))
    const d = B64URL_LUT.get(padded.charCodeAt(i + 3))
    // Any char not in the alphabet means corruption.
    if (
      a === undefined ||
      b === undefined ||
      c === undefined ||
      d === undefined
    ) {
      return null
    }
    const triple = (a << 18) | (b << 12) | (c << 6) | d
    const isFinal = i + 4 >= padded.length
    if (!isFinal) {
      bytes.push((triple >> 16) & 0xff, (triple >> 8) & 0xff, triple & 0xff)
    } else {
      // Final quartet: emit only the bytes that correspond to real input.
      // realLenInFinalQuartet is 1, 2, or 3 — never 0 (a quartet always
      // carries at least one real byte).
      if (realLenInFinalQuartet >= 1) bytes.push((triple >> 16) & 0xff)
      if (realLenInFinalQuartet >= 2) bytes.push((triple >> 8) & 0xff)
      if (realLenInFinalQuartet >= 3) bytes.push(triple & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

/**
 * Deterministic JSON serializer: sorts object keys alphabetically at **every**
 * depth (not just the top level). Arrays preserve order. Non-plain-object
 * values (Date, etc.) are not expected in {@link ShareSnapshot} and fall back
 * to default serialization.
 *
 * `JSON.stringify(value, keys)` only whitelists the given keys at the current
 * depth — passing top-level key names would silently drop nested data. Hence
 * the recursive pre-sort.
 */
function stableStringify(value: unknown): string {
  const seen: Set<unknown> = new Set() // cycle guard
  const sort = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input
    if (seen.has(input)) throw new Error('cycle')
    seen.add(input)
    if (Array.isArray(input)) {
      return input.map(sort)
    }
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      sorted[key] = sort((input as Record<string, unknown>)[key])
    }
    return sorted
  }
  return JSON.stringify(sort(value))
}

/**
 * Encode a {@link ShareSnapshot} into a compact base64url string.
 *
 * Pipeline: JSON.stringify (deterministic key order) → gzip → base64url.
 *
 * Does **not** enforce {@link MAX_SHARE_LENGTH} — callers check the return
 * value's length before using it in a URL.
 */
export function encodeShare(snapshot: ShareSnapshot): string {
  // Stable JSON (keys sorted at every depth) so identical snapshots encode to
  // byte-identical strings — required for the "deterministic output" property
  // the codec tests assert on.
  const json = stableStringify(snapshot)
  const utf8 = new TextEncoder().encode(json)
  const compressed = gzip(utf8)
  return uint8ToBase64Url(compressed)
}

/**
 * Decode a base64url-encoded share string back to a {@link ShareSnapshot}.
 *
 * Returns `null` on any malformed input (truncated string, invalid characters,
 * corrupt gzip, invalid JSON, wrong version). **Never throws.**
 */
export function decodeShare(encoded: string): ShareSnapshot | null {
  // 1. Base64url decode
  const bytes = base64UrlToUint8(encoded)
  if (bytes === null || bytes.length === 0) return null

  // 2. Gunzip (pako 3 returns Uint8Array)
  let json: string
  try {
    const decompressed = inflate(bytes)
    json = new TextDecoder().decode(decompressed)
  } catch {
    return null
  }

  // 3. JSON parse
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  // 4. Validate shape
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).version !== 1
  ) {
    return null
  }

  return parsed as ShareSnapshot
}
