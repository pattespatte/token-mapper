import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'

/**
 * Sidebar smoke test.
 *
 * Covers the collapse/expand toggle and the hiding of the content list
 * when collapsed. We mock useGallery, useTokenSets, and useSidebar so the
 * test stays focused on the component's own behavior.
 */

// Mocks for the three composables. Reset between tests in beforeEach.
let mockCategories: ReturnType<typeof ref<{ name: string; count: number }[]>>
let mockActiveCategory: ReturnType<typeof ref<string>>
let mockBrowseSet: ReturnType<typeof ref<unknown>>
let mockIsComparing: ReturnType<typeof ref<boolean>>
let mockCollapsed: ReturnType<typeof ref<boolean>>
const mockToggle = vi.fn()

vi.mock('@/composables/useGallery', () => ({
  useGallery: () => ({
    get categories() {
      return mockCategories
    },
    get activeCategory() {
      return mockActiveCategory
    },
    get browseSet() {
      return mockBrowseSet
    },
  }),
}))

vi.mock('@/composables/useTokenSets', () => ({
  useTokenSets: () => ({
    get isComparing() {
      return mockIsComparing
    },
  }),
}))

vi.mock('@/composables/useSidebar', () => ({
  useSidebar: () => ({
    get collapsed() {
      return mockCollapsed
    },
    toggle: mockToggle,
    // sidebarWidth is consumed by App.vue, not Sidebar.vue; not needed here.
    sidebarWidth: computed(() => (mockCollapsed.value ? '32px' : '240px')),
  }),
}))

// Import *after* the mocks are registered.
const Sidebar = (await import('@/components/Sidebar.vue')).default

describe('Sidebar', () => {
  beforeEach(() => {
    mockCategories = ref([
      { name: 'all', count: 5 },
      { name: 'color', count: 3 },
      { name: 'spacing', count: 2 },
    ])
    mockActiveCategory = ref('all')
    // Non-null browseSet triggers the categories branch.
    mockBrowseSet = ref({ label: 'demo', tokens: new Map() })
    mockIsComparing = ref(false)
    mockCollapsed = ref(false)
    mockToggle.mockReset()
  })

  it('renders the toggle button with aria-expanded=true when expanded', () => {
    const wrapper = mount(Sidebar)
    const toggle = wrapper.find('.dtv-sidebar__toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-controls')).toBe('dtv-sidebar-content')
  })

  it('renders the toggle button with aria-expanded=false when collapsed', () => {
    mockCollapsed = ref(true)
    const wrapper = mount(Sidebar)
    const toggle = wrapper.find('.dtv-sidebar__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('calls toggle() when the toggle button is clicked', async () => {
    const wrapper = mount(Sidebar)
    await wrapper.find('.dtv-sidebar__toggle').trigger('click')
    expect(mockToggle).toHaveBeenCalledTimes(1)
  })

  it('shows category list when expanded', () => {
    const wrapper = mount(Sidebar)
    const items = wrapper.findAll('.dtv-sidebar__item')
    expect(items).toHaveLength(3)
    // "all", "color", "spacing" should each render with their count.
    expect(wrapper.text()).toContain('color')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('spacing')
    expect(wrapper.text()).toContain('2')
  })

  it('marks the category list as hidden when collapsed', () => {
    mockCollapsed = ref(true)
    const wrapper = mount(Sidebar)
    const content = wrapper.find('#dtv-sidebar-content')
    expect(content.exists()).toBe(true)
    expect(content.classes()).toContain('dtv-sidebar__content--hidden')
    // Toggle stays visible in both states.
    expect(wrapper.find('.dtv-sidebar__toggle').exists()).toBe(true)
  })

  it('shows the no-set prompt when browseSet is null and not comparing', () => {
    mockBrowseSet = ref(null)
    const wrapper = mount(Sidebar)
    expect(wrapper.text()).toContain('No set loaded')
    expect(wrapper.text()).toContain('Load demo')
  })

  it('shows the compare-mode note naming the FilterBar buckets when comparing', () => {
    mockIsComparing = ref(true)
    const wrapper = mount(Sidebar)
    expect(wrapper.text()).toContain('Comparing two sets')
    // The sharpened copy names the FilterBar labels.
    expect(wrapper.text()).toContain('Matching')
    expect(wrapper.text()).toContain('Changed')
    expect(wrapper.text()).toContain('Missing')
    expect(wrapper.text()).toContain('Extra')
  })

  it('updates the toggle aria-label for each state', () => {
    const wrapperExpanded = mount(Sidebar)
    expect(wrapperExpanded.find('.dtv-sidebar__toggle').attributes('aria-label')).toBe(
      'Collapse categories'
    )

    mockCollapsed = ref(true)
    const wrapperCollapsed = mount(Sidebar)
    expect(wrapperCollapsed.find('.dtv-sidebar__toggle').attributes('aria-label')).toBe(
      'Expand categories'
    )
  })
})
