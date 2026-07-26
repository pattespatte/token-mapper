import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import DiffInspector from '@/components/DiffInspector.vue'
import type { TokenDiff } from '@/types/diff'

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
    expect(w.find('.dtv-inspector-overlay').exists()).toBe(false)
  })

  it('renders path + bucket when open', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtv-inspector-overlay').exists()).toBe(true)
    expect(w.get('.dtv-inspector__path').text()).toBe('color.accent')
    expect(w.get('.dtv-diffinspector__bucket').text()).toBe('changed')
  })

  it('shows two side-by-side columns for changed (both present)', async () => {
    selectedDiff = computed(() => makeBothDiff('changed'))
    const w = mountFresh()
    await flushPromises()
    // Both A and B sidlabels should be in the side-by-side grid.
    const sides = w.findAll('.dtv-diffinspector__sides .dtv-diffinspector__side')
    expect(sides).toHaveLength(2)
    expect(sides[0]!.classes()).toContain('dtv-diffinspector__side--a')
    expect(sides[1]!.classes()).toContain('dtv-diffinspector__side--b')
  })

  it('shows two side-by-side columns for matching', async () => {
    selectedDiff = computed(() => makeBothDiff('matching'))
    const w = mountFresh()
    await flushPromises()
    const sides = w.findAll('.dtv-diffinspector__sides .dtv-diffinspector__side')
    expect(sides).toHaveLength(2)
  })

  it('shows single A side + "not in set B" for missing', async () => {
    selectedDiff = computed(() => makeMissingDiff())
    const w = mountFresh()
    await flushPromises()
    // Single-side container is used.
    expect(w.find('.dtv-diffinspector__sides').exists()).toBe(false)
    expect(w.find('.dtv-diffinspector__single').exists()).toBe(true)
    expect(w.findAll('.dtv-diffinspector__side--a')).toHaveLength(1)
    expect(w.get('.dtv-diffinspector__absent').text()).toContain('not in set B')
  })

  it('shows single B side + "not in set A" for extra', async () => {
    selectedDiff = computed(() => makeExtraDiff())
    const w = mountFresh()
    await flushPromises()
    expect(w.find('.dtv-diffinspector__single').exists()).toBe(true)
    expect(w.findAll('.dtv-diffinspector__side--b')).toHaveLength(1)
    expect(w.get('.dtv-diffinspector__absent').text()).toContain('not in set A')
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
    await w.get('.dtv-inspector__close').trigger('click')
    expect(clearDiffSelection).toHaveBeenCalledTimes(1)
  })
})
