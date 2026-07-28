/**
 * useShare — URL-hash sharing of loaded token sets.
 *
 * Builds a {@link ShareSnapshot} from the currently-loaded sources (set A and/or
 * set B), encodes it via {@link encodeShare}, and stuffs it into the URL hash
 * so a teammate can open the same URL and see the same sets.
 *
 * Precedence on mount (see `App.vue`):
 *   1. If a hash is present → load from it; skip localStorage.
 *   2. Else if localStorage has a snapshot → load that.
 *   3. Else → empty dropzones.
 *
 * Size guard: `MAX_SHARE_LENGTH` (32 000 chars) is the ceiling for a shareable
 * URL. Above it, `encodeCurrentState` returns `{ ok: false, reason: 'too-large' }`
 * so the UI can nudge the user toward the export feature instead.
 *
 * Module-scoped (no state of its own beyond what it reads from `useTokenSets`)
 * — keeps the singleton-store pattern of the other composables.
 */

import {
  encodeShare,
  decodeShare,
  MAX_SHARE_LENGTH,
  type ShareSnapshot,
} from '@/utils/shareCodec'
import { useTokenSets } from './useTokenSets'
import type { InputFile } from '@dtcg-mapper/core'

/** Outcome of {@link encodeCurrentState}. Discriminated by `ok`. */
export type EncodeResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'empty' | 'too-large' }

/** Outcome of {@link copyShareLink}. Discriminated by `ok`. */
export type CopyShareResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'too-large' | 'clipboard' }

/** Outcome of {@link loadFromHash}. */
export type LoadResult = { loaded: 'A' | 'B' | 'both' | 'none' }

export function useShare() {
  const { getSources, addInputs } = useTokenSets()

  /**
   * Build a {@link ShareSnapshot} from the live source arrays and encode it.
   *
   * Returns `{ ok: false, reason: 'empty' }` when no sets are loaded (so the
   * UI can show "Load a set first" rather than emitting a useless hash),
   * and `{ ok: false, reason: 'too-large' }` when the encoded form exceeds
   * {@link MAX_SHARE_LENGTH} (the caller should then suggest export).
   */
  function encodeCurrentState(): EncodeResult {
    const a = getSources('A')
    const b = getSources('B')
    if (a.length === 0 && b.length === 0) {
      return { ok: false, reason: 'empty' }
    }
    const snapshot: ShareSnapshot = {
      version: 1,
      sets: {
        ...(a.length > 0 ? { A: a as InputFile[] } : {}),
        ...(b.length > 0 ? { B: b as InputFile[] } : {}),
      },
    }
    const hash = encodeShare(snapshot)
    if (hash.length > MAX_SHARE_LENGTH) {
      return { ok: false, reason: 'too-large' }
    }
    return { ok: true, hash }
  }

  /**
   * Write a hash string into `window.location.hash`. No-op outside the browser
   * (jsdom provides `window.location`; SSR would not).
   *
   * Replaces rather than appends: any existing hash is overwritten.
   */
  function writeToUrl(hash: string): void {
    if (typeof window === 'undefined') return
    window.location.hash = hash
  }

  /**
   * Read the share hash from `window.location.hash` (without the leading `#`).
   * Returns `null` when there is no hash or outside the browser.
   */
  function readFromUrl(): string | null {
    if (typeof window === 'undefined') return null
    const raw = window.location.hash
    if (raw === '' ) return null
    // strip leading '#' (or '#/' if a history-mode hash sneaks in)
    return raw.replace(/^#\/?/, '')
  }

  /**
   * Decode a hash and load whatever sets it carries into `useTokenSets`.
   *
   * Reuses {@link useTokenSets.addInputs} so validation/resolution is
   * identical to a manual upload — no parallel code path.
   *
   * Returns a {@link LoadResult} describing which sides were populated. Any
   * decode failure (corrupt hash, wrong version) yields `{ loaded: 'none' }`
   * and leaves the slots untouched.
   */
  function loadFromHash(hash: string): LoadResult {
    const snapshot = decodeShare(hash)
    if (snapshot === null) return { loaded: 'none' }
    const hasA = Array.isArray(snapshot.sets.A) && snapshot.sets.A.length > 0
    const hasB = Array.isArray(snapshot.sets.B) && snapshot.sets.B.length > 0
    if (hasA) addInputs('A', snapshot.sets.A!)
    if (hasB) addInputs('B', snapshot.sets.B!)
    if (hasA && hasB) return { loaded: 'both' }
    if (hasA) return { loaded: 'A' }
    if (hasB) return { loaded: 'B' }
    return { loaded: 'none' }
  }

  /**
   * One-shot "copy share link to clipboard": encode → write to URL → copy URL.
   *
   * The URL is written *before* the clipboard copy so that even on clipboard
   * failure ({@link CopyShareResult.reason} `'clipboard'`) the link is still
   * in the address bar — the user can copy it manually.
   *
   * Returns the underlying {@link EncodeResult} failures (`'empty'` /
   * `'too-large'`) directly; wraps clipboard rejections as
   * `{ ok: false, reason: 'clipboard' }`.
   */
  async function copyShareLink(): Promise<CopyShareResult> {
    const enc = encodeCurrentState()
    if (!enc.ok) return enc
    writeToUrl(enc.hash)
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return { ok: false, reason: 'clipboard' }
    }
    try {
      await navigator.clipboard.writeText(window.location.href)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'clipboard' }
    }
  }

  return {
    encodeCurrentState,
    writeToUrl,
    readFromUrl,
    loadFromHash,
    copyShareLink,
  }
}
