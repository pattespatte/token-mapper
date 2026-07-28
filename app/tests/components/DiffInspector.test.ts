import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import DiffInspector from '@/components/DiffInspector.vue'
import type { TokenDiff } from '@dtcg-mapper/core'

/**
 * DiffInspector smoke test.
 *
 * Mocks `useGallery` so the component gets a controllable `selectedDiff`
 * computed and a `clearDiffSelection` spy. We verify the modal renders
 * nothing when closed, renders the path + bucket when open, and shows the
 * right layout (side-by-side vs single-side) per bucket.
 */

const clearDiffSelection = vi.fn()

let selectedDiff: ComputedRef<TokenDiff | null>

vi.mock('@/composables/useGallery', () => ({
  useGallery: () => ({
    get selectedDiff() {
      return selectedDiff
    },
    clearDiffSelection,
  }),
}))

// Import *after* the mock is registered.
await import('@/components/DiffInspector.vue')

/** Build a hand-rolled TokenDiff fixture for the matching/changed cases. */
function makeBothDiff(bucket: 'matching' | 'changed'): TokenDiff {
  return {
    path: 'color.accent',
    bucket,
    a: {
      path: 'color.accent',
      segments: ['color', 'accent'],
      rawValue: '{color.indigo.500}',
      type: 'color',
      resolvedValue: '#6366f1',
      aliasChain: [{ path: 'color.indigo.500', raw: '{color.indigo.500}', resolved: '#6366f1' }],
      hasError: false,
    },
    b: {
      path: 'color.accent',
      segments: ['color', 'accent'],
      rawValue: '#4338ca',
      type: 'color',
      resolvedValue: '#4338ca',
      aliasChain: [],
      hasError: false,
    },
  }
}

function makeMissingDiff(): TokenDiff {
  return {
    path: 'color.only-in-a',
    bucket: 'missing',
    a: {
      path: 'color.only-in-a',
      segments: ['color', 'only-in-a'],
      rawValue: '#ff0000',
      type: 'color',
      resolvedValue: '#ff0000',
      aliasChain: [],
      hasError: false,
    },
  }
}

function makeExtraDiff(): TokenDiff {
  return {
    path: 'color.only-in-b',
    bucket: 'extra',
    b: {
      path: 'color.only-in-b',
      segments: ['color', 'only-in-b'],
      rawValue: '#00ff00',
      type: 'color',
      resolvedValue: '#00ff00',
      aliasChain: [],
      hasError: false,
    },
  }
}

describe('DiffInspector', () => {
  // Track the most recently mounted wrapper so we can unmount it before the
  // next test. Each DiffInspector attaches a document-level keydown listener
  // on mount; without unmounting, previous instances would still react to
  // Esc and inflate the call count on the shared mock.
  let wrapper: ReturnType<typeof mount> | undefined

  function mountFresh() {
    wrapper?.unmount()
    wrapper = mount(DiffInspector)
    return wrapper
  }

  beforeEach(() => {
    selectedDiff = computed(() => null)
    clearDiffSelection.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('renders nothing when selectedDiff is null', () => {
    const w = mountFresh()
    expect(w.find('.dtm-inspector-overlay').exists()).toBe(false)
  })

  it('renders path + bucket when open', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-inspector-overlay').exists()).toBe(true)
    expect(w.get('.dtm-inspector__path').text()).toBe('color.accent')
    expect(w.get('.dtm-diffinspector__bucket').text()).toBe('changed')
  })

  it('shows two side-by-side columns for changed (both present)', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    // Both A and B sidlabels should be in the side-by-side grid.
    const sides = w.findAll('.dtm-diffinspector__sides .dtm-diffinspector__side')
    expect(sides).toHaveLength(2)
    expect(sides[0]!.classes()).toContain('dtm-diffinspector__side--a')
    expect(sides[1]!.classes()).toContain('dtm-diffinspector__side--b')
  })

  it('shows two side-by-side columns for matching', async () => {
    selectedDiff = computed(() => makeBothDiff('matching'))
    const w = mountFresh()
    await flushPromises()
    const sides = w.findAll('.dtm-diffinspector__sides .dtm-diffinspector__side')
    expect(sides).toHaveLength(2)
  })

  it('shows single A side + "not in set B" for missing', async () => {
    selectedDiff = computed(() => makeMissingDiff())
    const w = mountFresh()
    await flushPromises()
    // Single-side container is used.
    expect(w.find('.dtm-diffinspector__sides').exists()).toBe(false)
    expect(w.find('.dtm-diffinspector__single').exists()).toBe(true)
    expect(w.findAll('.dtm-diffinspector__side--a')).toHaveLength(1)
    expect(w.get('.dtm-diffinspector__absent').text()).toContain('not in set B')
  })

  it('shows single B side + "not in set A" for extra', async () => {
    selectedDiff = computed(() => makeExtraDiff())
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-diffinspector__single').exists()).toBe(true)
    expect(w.findAll('.dtm-diffinspector__side--b')).toHaveLength(1)
    expect(w.get('.dtm-diffinspector__absent').text()).toContain('not in set A')
  })

  it('Esc closes the modal via clearDiffSelection', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    mountFresh()
    await flushPromises()
    // Simulate a document-level Esc.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(clearDiffSelection).toHaveBeenCalledTimes(1)
  })

  it('close button calls clearDiffSelection', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    await w.get('.dtm-inspector__close').trigger('click')
    expect(clearDiffSelection).toHaveBeenCalledTimes(1)
  })

  /* -------------------------- Tier 2: explanation --------------------------- */

  it('shows "What changed" details when explanation has details', async () => {
    const diff = makeBothDiff('changed')
    diff.explanation = {
      summary: '+4px',
      details: [
        { label: 'value', before: '16px', after: '20px' },
        { label: 'delta', before: '', after: '+4px' },
      ],
    }
    selectedDiff = computed(() => diff)
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-diffinspector__changed').exists()).toBe(true)
    expect(w.get('.dtm-inspector__heading').text()).toBe('What changed')
    const rows = w.findAll('.dtm-diffinspector__changed-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('dt').text()).toBe('value')
    expect(rows[0]!.findAll('code')[0]!.text()).toBe('16px')
    expect(rows[0]!.findAll('code')[1]!.text()).toBe('20px')
  })

  it('hides "What changed" section when explanation has no details', async () => {
    const diff = makeBothDiff('changed')
    diff.explanation = { summary: 'Δ23' } // summary-only, no details array
    selectedDiff = computed(() => diff)
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-diffinspector__changed').exists()).toBe(false)
  })

  it('hides "What changed" section when explanation is undefined', async () => {
    // Even though bucket is 'changed', no explanation attached.
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-diffinspector__changed').exists()).toBe(false)
  })

  it('hides "What changed" section for matching tokens', async () => {
    const diff = makeBothDiff('matching')
    diff.explanation = {
      summary: 'identical',
      details: [{ label: 'noop', before: 'x', after: 'x' }],
    }
    selectedDiff = computed(() => diff)
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtm-diffinspector__changed').exists()).toBe(false)
  })

  it('renders "—" placeholder for empty before-value in details', async () => {
    const diff = makeBothDiff('changed')
    diff.explanation = {
      summary: '+4px',
      details: [{ label: 'delta', before: '', after: '+4px' }],
    }
    selectedDiff = computed(() => diff)
    const w = mountFresh()
    await flushPromises()
    const row = w.findAll('.dtm-diffinspector__changed-row')[0]!
    // before is empty → placeholder shown, before-<code> absent.
    expect(row.get('.dtm-diffinspector__changed-empty').text()).toBe('—')
    // after still has its <code>.
    const codes = row.findAll('code')
    expect(codes).toHaveLength(1)
    expect(codes[0]!.text()).toBe('+4px')
  })
})
