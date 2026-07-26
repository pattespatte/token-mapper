import { describe, expect, it, beforeEach } from 'vitest'
import { useSearch, tokenMatchesQuery } from '@/composables/useSearch'
import { parseFiles } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import type { InputFile } from '@/pipeline/parse'
import type { ResolvedToken, ResolvedTokenMap } from '@/types/token'

/**
 * Build a resolved token map from raw DTCG JSON so tests work with the same
 * ResolvedToken shape the predicate sees in production. Mirrors the helper in
 * tests/pipeline/diff.test.ts.
 */
function resolvedOf(...json: string[]): ResolvedTokenMap {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  return resolve(parseFiles(files).tokens)
}

/** Pull a single resolved token out of a map by path. */
function tokenAt(map: ResolvedTokenMap, path: string): ResolvedToken {
  const t = map.get(path)
  if (t === undefined) throw new Error(`no token at ${path}`)
  return t
}

const FIXTURE = JSON.stringify({
  color: {
    indigo: {
      '500': { $type: 'color', $value: '#6366f1' },
    },
    accent: {
      $type: 'color',
      $value: '{color.indigo.500}',
      $description: 'Primary accent for links and actions.',
    },
  },
  typography: {
    body: {
      $type: 'typography',
      $value: {
        fontFamily: 'Inter',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: 1.5,
      },
    },
  },
})

describe('tokenMatchesQuery (pure predicate)', () => {
  let map: ResolvedTokenMap
  beforeEach(() => {
    map = resolvedOf(FIXTURE)
  })

  it('matches everything when query is empty', () => {
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, '')).toBe(true)
  })

  it('matches everything when query is whitespace-only', () => {
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, '   ')).toBe(true)
    expect(tokenMatchesQuery(token, '\t')).toBe(true)
  })

  it('matches by path (case-insensitive substring)', () => {
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, 'indigo')).toBe(true)
    expect(tokenMatchesQuery(token, 'INDIGO')).toBe(true)
    expect(tokenMatchesQuery(token, 'color.ind')).toBe(true)
  })

  it('matches by $description', () => {
    const token = tokenAt(map, 'color.accent')
    expect(tokenMatchesQuery(token, 'accent')).toBe(true) // also path
    expect(tokenMatchesQuery(token, 'links')).toBe(true) // description-only
    expect(tokenMatchesQuery(token, 'primary')).toBe(true) // description-only
  })

  it('matches by primitive resolved value', () => {
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, '#6366f1')).toBe(true)
    expect(tokenMatchesQuery(token, '6366')).toBe(true)
  })

  it('matches resolved alias value (alias resolves to literal, then literal is searched)', () => {
    const token = tokenAt(map, 'color.accent')
    // Resolves to #6366f1; searching the literal should find the alias too.
    expect(tokenMatchesQuery(token, '#6366f1')).toBe(true)
  })

  it('matches inside composite resolved value (typography field value)', () => {
    const token = tokenAt(map, 'typography.body')
    expect(tokenMatchesQuery(token, 'Inter')).toBe(true)
    expect(tokenMatchesQuery(token, '16px')).toBe(true)
    expect(tokenMatchesQuery(token, 'fontWeight')).toBe(true) // JSON key also searchable
  })

  it('returns false when nothing matches', () => {
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, 'nonexistent')).toBe(false)
    expect(tokenMatchesQuery(token, 'typography')).toBe(false) // not in this token
  })

  it('matches each field independently (substring across fields)', () => {
    // "color" appears in the path of color.indigo.500 but not in its value.
    const token = tokenAt(map, 'color.indigo.500')
    expect(tokenMatchesQuery(token, 'color')).toBe(true)
  })
})

describe('useSearch (composable)', () => {
  beforeEach(() => {
    // Reset module-scoped query between tests so they don't leak.
    const { clearInput } = useSearch()
    clearInput()
  })

  it('exposes a reactive query ref', () => {
    const { query } = useSearch()
    expect(query.value).toBe('')
    query.value = 'indigo'
    expect(query.value).toBe('indigo')
  })

  it('matchPredicate returns true for all tokens when query is empty', () => {
    const map = resolvedOf(FIXTURE)
    const { matchPredicate } = useSearch()
    const pred = matchPredicate.value
    for (const token of map.values()) {
      expect(pred(token)).toBe(true)
    }
  })

  it('matchPredicate reacts to query changes', () => {
    const map = resolvedOf(FIXTURE)
    const { query, matchPredicate } = useSearch()

    query.value = 'indigo'
    expect(matchPredicate.value(tokenAt(map, 'color.indigo.500'))).toBe(true)
    expect(matchPredicate.value(tokenAt(map, 'typography.body'))).toBe(false)

    query.value = 'Inter'
    expect(matchPredicate.value(tokenAt(map, 'color.indigo.500'))).toBe(false)
    expect(matchPredicate.value(tokenAt(map, 'typography.body'))).toBe(true)
  })

  it('clearInput resets the query to empty', () => {
    const { query, clearInput } = useSearch()
    query.value = 'something'
    clearInput()
    expect(query.value).toBe('')
  })

  it('state is shared across calls (module singleton)', () => {
    const a = useSearch()
    const b = useSearch()
    a.query.value = 'shared'
    expect(b.query.value).toBe('shared')
  })
})
