import { describe, expect, it, beforeEach } from 'vitest'
import {
  useFilters,
  tokenMatchesFilters,
  computeFilterCounts,
  typeKeyFor,
  OTHER_TYPE,
} from '@/composables/useFilters'
import { parseFiles } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import { validate } from '@/pipeline/validate'
import type { InputFile } from '@/pipeline/parse'
import type { ResolvedToken, TokenSet } from '@/types/token'

/**
 * Build a TokenSet from raw DTCG JSON. Mirrors the production pipeline
 * (parse → validate → resolve) so tests exercise the real ResolvedToken
 * shape, including aliasChain and validation paths.
 */
function setOf(...json: string[]): TokenSet {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  const { tokens, issues: parseIssues } = parseFiles(files)
  const validationIssues = validate(tokens)
  const resolved = resolve(tokens)
  return {
    id: 'A',
    label: 'test',
    sourceFiles: files.map((f) => f.name),
    tokens,
    resolved,
    validation: [...parseIssues, ...validationIssues],
  }
}

/** Pull a single resolved token out of a set by path. */
function tokenAt(set: TokenSet, path: string): ResolvedToken {
  const t = set.resolved.get(path)
  if (t === undefined) throw new Error(`no token at ${path}`)
  return t
}

// A mixed-shape fixture: literal color, dimension, typography, an alias,
// and an unknown-type token (for OTHER_TYPE bucket).
const MIXED = JSON.stringify({
  color: {
    indigo: { $type: 'color', $value: '#6366f1' },
    accent: { $type: 'color', $value: '{color.indigo}', $description: 'alias' },
  },
  space: { md: { $type: 'dimension', $value: '16px' } },
  type: { body: { $type: 'typography', $value: { fontFamily: 'Inter' } } },
  weird: { thing: { $type: 'mystery', $value: '???' } },
})

// A fixture with a validation issue: missing $type triggers MISSING_TYPE.
const WITH_ISSUE = JSON.stringify({
  noType: { thing: { $value: 'no $type here' } },
})

describe('typeKeyFor', () => {
  it('returns the type for known renderer types', () => {
    const set = setOf(MIXED)
    expect(typeKeyFor(tokenAt(set, 'color.indigo'))).toBe('color')
    expect(typeKeyFor(tokenAt(set, 'space.md'))).toBe('dimension')
    expect(typeKeyFor(tokenAt(set, 'type.body'))).toBe('typography')
  })

  it('returns OTHER_TYPE for unknown types', () => {
    const set = setOf(MIXED)
    expect(typeKeyFor(tokenAt(set, 'weird.thing'))).toBe(OTHER_TYPE)
  })

  it('returns OTHER_TYPE when type is undefined', () => {
    const set = setOf(WITH_ISSUE)
    expect(typeKeyFor(tokenAt(set, 'noType.thing'))).toBe(OTHER_TYPE)
  })
})

describe('tokenMatchesFilters (pure predicate)', () => {
  let set: TokenSet
  beforeEach(() => {
    set = setOf(MIXED)
  })

  it('passes everything when both sets are empty', () => {
    for (const t of set.resolved.values()) {
      expect(tokenMatchesFilters(t, set, new Set(), new Set())).toBe(true)
    }
  })

  it('filters by a single $type (OR within facet)', () => {
    const types = new Set(['color'])
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, types, new Set())).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'color.accent'), set, types, new Set())).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'space.md'), set, types, new Set())).toBe(false)
    expect(tokenMatchesFilters(tokenAt(set, 'type.body'), set, types, new Set())).toBe(false)
  })

  it('filters by multiple $types (OR within facet)', () => {
    const types = new Set(['color', 'dimension'])
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, types, new Set())).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'space.md'), set, types, new Set())).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'type.body'), set, types, new Set())).toBe(false)
  })

  it('OTHER_TYPE matches unknown types and undefined-type tokens', () => {
    const types = new Set([OTHER_TYPE])
    expect(tokenMatchesFilters(tokenAt(set, 'weird.thing'), set, types, new Set())).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, types, new Set())).toBe(false)
  })

  it('alias facet matches tokens with non-empty aliasChain', () => {
    const facets = new Set(['alias'] as const)
    expect(tokenMatchesFilters(tokenAt(set, 'color.accent'), set, new Set(), facets)).toBe(true)
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, new Set(), facets)).toBe(false)
  })

  it('issues facet matches tokens whose path appears in validation', () => {
    const issueSet = setOf(WITH_ISSUE)
    // noType.thing has MISSING_TYPE issue at path 'noType.thing'
    const facets = new Set(['issues'] as const)
    expect(
      tokenMatchesFilters(tokenAt(issueSet, 'noType.thing'), issueSet, new Set(), facets)
    ).toBe(true)
  })

  it('issues facet rejects tokens without issues', () => {
    const facets = new Set(['issues'] as const)
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, new Set(), facets)).toBe(false)
  })

  it('type AND alias facets combine (both must pass)', () => {
    const types = new Set(['color'])
    const facets = new Set(['alias'] as const)
    // color.indigo is color but not alias → fails
    expect(tokenMatchesFilters(tokenAt(set, 'color.indigo'), set, types, facets)).toBe(false)
    // color.accent is color AND alias → passes
    expect(tokenMatchesFilters(tokenAt(set, 'color.accent'), set, types, facets)).toBe(true)
    // space.md is alias-facet-passing? no — it's not alias → fails anyway
    expect(tokenMatchesFilters(tokenAt(set, 'space.md'), set, types, facets)).toBe(false)
  })

  it('alias OR issues within facet (both active = both must pass)', () => {
    // alias AND issues — no token has both → nothing passes
    const facets = new Set(['alias', 'issues'] as const)
    for (const t of set.resolved.values()) {
      expect(tokenMatchesFilters(t, set, new Set(), facets)).toBe(false)
    }
  })
})

describe('computeFilterCounts (population counts)', () => {
  it('returns zeros for null set', () => {
    const counts = computeFilterCounts(null)
    expect(counts.types).toEqual({})
    expect(counts.alias).toBe(0)
    expect(counts.issues).toBe(0)
  })

  it('counts each $type and assigns unknown to OTHER_TYPE', () => {
    const set = setOf(MIXED)
    const counts = computeFilterCounts(set)
    expect(counts.types).toEqual({
      color: 2, // indigo + accent
      dimension: 1,
      typography: 1,
      [OTHER_TYPE]: 1, // weird.thing
    })
  })

  it('counts aliased tokens', () => {
    const set = setOf(MIXED)
    const counts = computeFilterCounts(set)
    expect(counts.alias).toBe(1) // color.accent only
  })

  it('counts tokens with validation issues', () => {
    const issueSet = setOf(WITH_ISSUE)
    const counts = computeFilterCounts(issueSet)
    expect(counts.issues).toBe(1) // noType.thing
  })

  it('counts reflect full population, not filtered view (decision #4)', () => {
    // Sanity: counts are independent of any active filter — they're computed
    // from the whole set every time. This test exists to lock in that the
    // function signature does NOT take filters as input.
    const set = setOf(MIXED)
    const counts = computeFilterCounts(set)
    expect(counts.types.color).toBe(2)
    // Calling again with no change returns the same thing.
    expect(computeFilterCounts(set).types.color).toBe(2)
  })
})

describe('useFilters (composable state)', () => {
  beforeEach(() => {
    const { clearAll } = useFilters()
    clearAll()
  })

  it('starts empty', () => {
    const { activeTypes, activeFacets } = useFilters()
    expect(activeTypes.value.size).toBe(0)
    expect(activeFacets.value.size).toBe(0)
  })

  it('toggleType adds then removes', () => {
    const { activeTypes, toggleType } = useFilters()
    toggleType('color')
    expect(activeTypes.value.has('color')).toBe(true)
    toggleType('color')
    expect(activeTypes.value.has('color')).toBe(false)
  })

  it('toggleFacet adds then removes', () => {
    const { activeFacets, toggleFacet } = useFilters()
    toggleFacet('alias')
    expect(activeFacets.value.has('alias')).toBe(true)
    toggleFacet('alias')
    expect(activeFacets.value.has('alias')).toBe(false)
  })

  it('clearAll empties both sets', () => {
    const { activeTypes, activeFacets, toggleType, toggleFacet, clearAll } = useFilters()
    toggleType('color')
    toggleFacet('alias')
    clearAll()
    expect(activeTypes.value.size).toBe(0)
    expect(activeFacets.value.size).toBe(0)
  })

  it('matchPredicate reacts to toggle state', () => {
    const set = setOf(MIXED)
    const { matchPredicate, toggleType } = useFilters()
    const pred = matchPredicate.value
    expect(pred(tokenAt(set, 'color.indigo'), set)).toBe(true)

    toggleType('dimension')
    const pred2 = matchPredicate.value
    expect(pred2(tokenAt(set, 'color.indigo'), set)).toBe(false)
    expect(pred2(tokenAt(set, 'space.md'), set)).toBe(true)
  })

  it('state is shared across calls (module singleton)', () => {
    const a = useFilters()
    const b = useFilters()
    a.toggleType('color')
    expect(b.activeTypes.value.has('color')).toBe(true)
  })
})
