/**
 * usePersistence — localStorage-backed save/restore of loaded token sets.
 *
 * Snapshots the accumulated `useTokenSets` source arrays to `localStorage`
 * under a versioned key, so a page reload (or a return visit) restores the
 * sets without the user re-uploading.
 *
 * Contract:
 *   - **Never throws.** Every storage access is wrapped in try/catch —
 *     Safari private mode, quota-exceeded, and disabled-storage contexts
 *     degrade silently to a no-op (with a `console.warn` for debugging).
 *   - **Empty state is not persisted** over real data. `saveState` skips the
 *     write when both source arrays are empty, so closing a tab without
 *     loading anything doesn't wipe a previously-saved session.
 *   - **Feature-detected.** `isPersistenceAvailable` lets the UI hide the
 *     "remember sets" affordance in environments without `localStorage`.
 *
 * Precedence on mount (see `App.vue`):
 *   1. URL hash wins (share-link load).
 *   2. localStorage (this module) — second.
 *   3. Empty dropzones.
 *
 * The composable is stateless of its own — it reads from `useTokenSets` and
 * `window.localStorage` directly. Module scope is used only for the constant
 * storage key.
 */

import { useTokenSets } from './useTokenSets'
import type { InputFile } from '@dtcg-mapper/core'

/**
 * localStorage key. Namespaced (`token-mapper:`) to avoid collisions, and
 * versioned (`:v1`) so a future format change can migrate or side-by-side
 * the old payload without breaking existing sessions.
 */
const STORAGE_KEY = 'token-mapper:v1'

/**
 * Shape of the persisted payload. `savedAt` is informational (debugging,
 * future "last session" UI); the loader doesn't depend on it.
 */
export interface PersistedState {
  version: 1
  sets: {
    A?: InputFile[]
    B?: InputFile[]
  }
  savedAt: string /** ISO timestamp */
}

export function usePersistence() {
  const { getSources, addInputs } = useTokenSets()

  /**
   * Feature-detect `window.localStorage`. Returns false in SSR, in browsers
   * that have disabled storage (e.g. cookie-blocking extensions), and in
   * Safari private mode where `setItem` throws on use.
   */
  function isPersistenceAvailable(): boolean {
    if (typeof window === 'undefined') return false
    if (!('localStorage' in window)) return false
    try {
      // Accessing `.localStorage` can itself throw in some sandboxed iframes.
      const ls = window.localStorage
      return ls !== null
    } catch {
      return false
    }
  }

  /**
   * Persist the current `useTokenSets` source arrays.
   *
   * Skips the write when both sides are empty (so an accidental save of a
   * blank session doesn't overwrite a previously-saved real one). All
   * storage errors are caught and warned — never thrown.
   */
  function saveState(): void {
    if (!isPersistenceAvailable()) return
    const a = getSources('A')
    const b = getSources('B')
    if (a.length === 0 && b.length === 0) return
    const payload: PersistedState = {
      version: 1,
      sets: {
        ...(a.length > 0 ? { A: a as InputFile[] } : {}),
        ...(b.length > 0 ? { B: b as InputFile[] } : {}),
      },
      savedAt: new Date().toISOString(),
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {
      // QuotaExceededError (set too large), SecurityError (private mode /
      // disabled storage), or sandboxed-iframe access denial. Degrade
      // silently — persistence is a convenience, not a correctness feature.
      console.warn(
        '[token-mapper] could not persist sets to localStorage:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  /**
   * Read and parse the persisted payload. Returns `null` if storage is
   * unavailable, the key is absent, the JSON is corrupt, or the `version`
   * field is missing/wrong. Never throws.
   */
  function loadState(): PersistedState | null {
    if (!isPersistenceAvailable()) return null
    let raw: string | null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== 1
    ) {
      return null
    }
    return parsed as PersistedState
  }

  /**
   * Restore both slots from the persisted payload via `useTokenSets.addInputs`
   * (same path as share-link loading — validation/resolution is identical to
   * a manual upload). Returns a description of which sides were populated.
   */
  function restoreFromStorage(): { loaded: 'A' | 'B' | 'both' | 'none' } {
    const state = loadState()
    if (state === null) return { loaded: 'none' }
    const hasA = Array.isArray(state.sets.A) && state.sets.A.length > 0
    const hasB = Array.isArray(state.sets.B) && state.sets.B.length > 0
    if (hasA) addInputs('A', state.sets.A!)
    if (hasB) addInputs('B', state.sets.B!)
    if (hasA && hasB) return { loaded: 'both' }
    if (hasA) return { loaded: 'A' }
    if (hasB) return { loaded: 'B' }
    return { loaded: 'none' }
  }

  /**
   * Remove the persisted payload. Called when the user explicitly clears all
   * sets so the next session starts clean (otherwise the just-cleared data
   * would re-appear on reload). Never throws.
   */
  function clearState(): void {
    if (!isPersistenceAvailable()) return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // No-op — see saveState for the rationale.
    }
  }

  return {
    isPersistenceAvailable,
    saveState,
    loadState,
    restoreFromStorage,
    clearState,
  }
}
