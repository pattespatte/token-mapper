/**
 * useTokenSets — the singleton reactive store for loaded token sets.
 *
 * Module-scoped refs mean every component calling `useTokenSets()` sees the
 * same state — no Pinia, no provide/inject wiring. The store owns the full
 * parse → validate → resolve pipeline invocation and exposes ready-to-use
 * `TokenSet` objects to the UI.
 *
 * Two slots (A and B) match the comparison UI. Uploads **append** to a slot:
 * picking `foundation.json` then picking `semantic.json` merges both into
 * one set, which is the canonical split for real design systems. Clearing a
 * slot (or loading the demo) resets it. `loadDemo()` seeds set A with the
 * bundled demo dataset so first-time visitors see something.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { parseFiles, type InputFile } from '@/pipeline/parse'
import { validate } from '@/pipeline/validate'
import { resolve } from '@/pipeline/resolve'
import type { TokenSet } from '@/types/token'
// Bundled demo dataset — small, generic, non-proprietary. Imported at build
// time (Vite handles JSON via resolveJsonModule) so the "Load demo" button
// works on the static GitHub Pages deployment with no network calls.
import demoFoundation from '@/data/demo/foundation.json'
import demoSemantic from '@/data/demo/semantic.json'
import demoComposition from '@/data/demo/composition.json'

/**
 * Demo files wrapped as InputFile[] for the pipeline. Re-serialised from the
 * imported JSON so the parser's filename-in-error-messages path still works.
 * Three files exercise: primitive colors/dimensions (foundation), semantic
 * aliases that cross-reference them (semantic), and the composite types
 * shadow/border/gradient (composition) — including aliases back into the
 * foundation palette.
 */
const DEMO_FILES: InputFile[] = [
  { name: 'foundation.json', content: JSON.stringify(demoFoundation) },
  { name: 'semantic.json', content: JSON.stringify(demoSemantic) },
  { name: 'composition.json', content: JSON.stringify(demoComposition) },
]

/** Module-scoped singleton state. Shared across every call of useTokenSets. */
const setA: Ref<TokenSet | null> = ref(null)
const setB: Ref<TokenSet | null> = ref(null)
/**
 * Source files accumulated per slot, in load order. Kept alongside the
 * built TokenSet so subsequent uploads can append and rebuild — the pipeline
 * is pure and runs over the merged source list every time.
 */
const sourcesA: InputFile[] = []
const sourcesB: InputFile[] = []

/** Get the mutable source array for a slot (so callers can append/clear). */
function sourcesFor(setId: 'A' | 'B'): InputFile[] {
  return setId === 'A' ? sourcesA : sourcesB
}

/** Get the slot ref for a slot. */
function refFor(setId: 'A' | 'B'): Ref<TokenSet | null> {
  return setId === 'A' ? setA : setB
}

/**
 * Build a TokenSet from pre-read input files. Runs the pipeline
 * (parse → validate → resolve) and packages the result. Never throws —
 * parse/validation errors are captured in `set.validation` and surfaced
 * through the UI rather than crashing the load.
 *
 * Pure-ish: no I/O. Callers convert browser File objects (or inline demo
 * content) to InputFile[] at the edges.
 */
function buildSet(
  id: 'A' | 'B',
  inputs: readonly InputFile[],
  label: string
): TokenSet {
  const { tokens, issues: parseIssues } = parseFiles(inputs)
  const validationIssues = validate(tokens)
  const resolved = resolve(tokens)

  return {
    id,
    label,
    sourceFiles: inputs.map((f) => f.name),
    tokens,
    resolved,
    validation: [...parseIssues, ...validationIssues],
  }
}

/** Derive a label from a list of source filenames. */
function labelForSources(sources: readonly InputFile[]): string {
  if (sources.length <= 1) return sources[0]?.name ?? 'untitled'
  return `${sources.length} files`
}

export function useTokenSets() {
  /**
   * Add browser-uploaded files to a slot. Reads each file's text, appends to
   * the slot's accumulated sources, and rebuilds the TokenSet over the
   * combined source list. Uploads never replace — clear the slot first if
   * you want to start over.
   */
  async function addFiles(setId: 'A' | 'B', files: File[]): Promise<void> {
    if (files.length === 0) return
    const newInputs: InputFile[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        content: await file.text(),
      }))
    )
    const sources = sourcesFor(setId)
    sources.push(...newInputs)
    const built = buildSet(setId, sources, labelForSources(sources))
    refFor(setId).value = built
  }

  /** Empty a slot and discard its accumulated sources. No-op if already empty. */
  function clearSet(setId: 'A' | 'B'): void {
    sourcesFor(setId).length = 0
    refFor(setId).value = null
  }

  /**
   * Load the bundled demo dataset into set A. Replaces whatever was in slot
   * A — demo is a "start fresh" action, not an append. Useful for first-time
   * visitors (no blank dropzone) and for anyone exploring without their own
   * files.
   */
  function loadDemo(): void {
    sourcesA.length = 0
    sourcesA.push(...DEMO_FILES)
    setA.value = buildSet('A', sourcesA, labelForSources(sourcesA))
  }

  /** True when both slots are loaded — gates the comparison UI. */
  const isComparing: ComputedRef<boolean> = computed(
    () => setA.value !== null && setB.value !== null
  )

  return {
    setA,
    setB,
    addFiles,
    loadDemo,
    clearSet,
    isComparing,
  }
}
