import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import FilterChips from '@/components/FilterChips.vue'

/**
 * FilterChips smoke test.
 *
 * Mocks `useGallery` so the component gets controllable `filterCounts` and
 * `filters` stand-ins without dragging in the full token-set pipeline. We
 * verify the chips render from counts, toggle on click, and reflect active
 * state through aria-pressed.
 */

const toggleType = vi.fn<(t: string) => void>()
const toggleFacet = vi.fn<(f: 'alias' | 'issues') => void>()

let activeTypes: ReturnType<typeof ref<Set<string>>>
let activeFacets: ReturnType<typeof ref<Set<'alias' | 'issues'>>>
let filterCounts: ReturnType<typeof computed>

vi.mock('@/composables/useGallery', () => ({
  useGallery: () => ({
    get filters() {
      return {
        get activeTypes() {
          return activeTypes
        },
        get activeFacets() {
          return activeFacets
        },
        toggleType,
        toggleFacet,
      }
    },
    get filterCounts() {
      return filterCounts
    },
  }),
}))

// Import *after* the mock is registered.
await import('@/components/FilterChips.vue')

function freshCounts() {
  return {
    types: {
      color: 3,
      dimension: 2,
      typography: 1,
      __other__: 1,
    },
    alias: 2,
    issues: 1,
  }
}

describe('FilterChips', () => {
  beforeEach(() => {
    activeTypes = ref(new Set<string>())
    activeFacets = ref(new Set<'alias' | 'issues'>())
    filterCounts = computed(() => freshCounts())
    toggleType.mockClear()
    toggleFacet.mockClear()
  })

  it('renders one chip per $type plus alias and issues', async () => {
    const wrapper = mount(FilterChips)
    await flushPromises()
    const chips = wrapper.findAll('button')
    // 4 type chips + 2 facet chips = 6.
    expect(chips).toHaveLength(6)
    const labels = chips.map((c) => c.get('.dtm-filterchips__label').text())
    expect(labels).toEqual(['color', 'dimension', 'typography', 'other', 'has alias', 'has issues'])
  })

  it('shows counts on each chip', async () => {
    const wrapper = mount(FilterChips)
    await flushPromises()
    const counts = wrapper.findAll('.dtm-filterchips__count').map((c) => c.text())
    expect(counts).toEqual(['3', '2', '1', '1', '2', '1'])
  })

  it('$type chip click calls toggleType with the type key', async () => {
    const wrapper = mount(FilterChips)
    await flushPromises()
    // First chip is "color".
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(toggleType).toHaveBeenCalledWith('color')
  })

  it('"other" chip click toggles with OTHER_TYPE sentinel (__other__)', async () => {
    const wrapper = mount(FilterChips)
    await flushPromises()
    // The 4th chip is "other".
    const otherChip = wrapper.findAll('button')[3]!
    await otherChip.trigger('click')
    expect(toggleType).toHaveBeenCalledWith('__other__')
  })

  it('alias chip click calls toggleFacet', async () => {
    const wrapper = mount(FilterChips)
    await flushPromises()
    // The 5th chip is "has alias".
    await wrapper.findAll('button')[4]!.trigger('click')
    expect(toggleFacet).toHaveBeenCalledWith('alias')
  })

  it('reflects active state via aria-pressed when type is active', async () => {
    activeTypes.value = new Set(['color'])
    const wrapper = mount(FilterChips)
    await flushPromises()
    const colorChip = wrapper.findAll('button')[0]!
    expect(colorChip.attributes('aria-pressed')).toBe('true')
    expect(colorChip.classes()).toContain('dtm-filterchips__chip--active')
  })

  it('omits chips whose count is zero', async () => {
    filterCounts = computed(() => ({
      types: { color: 2, __other__: 0 },
      alias: 0,
      issues: 0,
    }))
    const wrapper = mount(FilterChips)
    await flushPromises()
    const labels = wrapper.findAll('.dtm-filterchips__label').map((c) => c.text())
    expect(labels).toEqual(['color'])
  })

  it('renders nothing when set is empty (all counts zero)', async () => {
    filterCounts = computed(() => ({ types: {}, alias: 0, issues: 0 }))
    const wrapper = mount(FilterChips)
    await flushPromises()
    // The component's v-if hides the whole group.
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
