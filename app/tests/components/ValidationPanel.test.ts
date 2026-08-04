import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { ValidationIssue } from '@dtcg-mapper/core'

/**
 * ValidationPanel tests.
 *
 * Focus: the "Spec ↗" link rendered from each issue's optional `reference`
 * field. The panel reads its data from the `useTokenSets` singleton, so we
 * mock that composable to return controlled `setA` / `setB` refs carrying
 * fixed `validation` arrays — the same pattern used by Sidebar.test.ts.
 *
 * Covered:
 *   - issue with a `reference` → anchor renders with the correct href,
 *   - issue without a `reference` → no anchor rendered,
 *   - the link opens in a new tab (`target="_blank"`) with rel safety.
 *
 * Sorting / severity badges / toggle behaviour are exercised elsewhere; these
 * tests pin the reference-link contract only.
 */

/** Minimal issue fixture. Only the fields ValidationPanel reads are needed. */
function issueFixture(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    path: 'color.red',
    severity: 'warning',
    code: 'MISSING_TYPE',
    message: 'has no $type',
    reference: 'https://tr.designtokens.org/format/#type-0',
    ...overrides,
  }
}

// Controlled refs the mocked composable returns. Reset in beforeEach.
let mockSetA: ReturnType<typeof ref<{ validation: ValidationIssue[] } | null>>
let mockSetB: ReturnType<typeof ref<{ validation: ValidationIssue[] } | null>>

vi.mock('@/composables/useTokenSets', () => ({
  useTokenSets: () => ({
    get setA() {
      return mockSetA
    },
    get setB() {
      return mockSetB
    },
  }),
}))

// Import *after* the mock is registered.
const ValidationPanel = (await import('@/components/ValidationPanel.vue')).default

describe('ValidationPanel — spec reference link', () => {
  beforeEach(() => {
    mockSetA = ref(null)
    mockSetB = ref(null)
  })

  it('renders a "Spec ↗" link with the issue reference as href', () => {
    mockSetA.value = { validation: [issueFixture()] }
    const wrapper = mount(ValidationPanel, {
      props: { setId: 'A', open: true },
    })
    const link = wrapper.find('.dtm-validation__reference')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe(
      'https://tr.designtokens.org/format/#type-0'
    )
    expect(link.text()).toBe('Spec ↗')
  })

  it('opens the link in a new tab with rel="noopener noreferrer"', () => {
    mockSetA.value = { validation: [issueFixture()] }
    const wrapper = mount(ValidationPanel, {
      props: { setId: 'A', open: true },
    })
    const link = wrapper.find('.dtm-validation__reference')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders no link when the issue has no reference field', () => {
    mockSetA.value = {
      validation: [issueFixture({ reference: undefined })],
    }
    const wrapper = mount(ValidationPanel, {
      props: { setId: 'A', open: true },
    })
    expect(wrapper.find('.dtm-validation__reference').exists()).toBe(false)
  })

  it('renders one link per issue that carries a reference', () => {
    mockSetA.value = {
      validation: [
        issueFixture({ path: 'a', reference: 'https://example.com/a' }),
        issueFixture({ path: 'b', reference: undefined }),
        issueFixture({ path: 'c', reference: 'https://example.com/c' }),
      ],
    }
    const wrapper = mount(ValidationPanel, {
      props: { setId: 'A', open: true },
    })
    const links = wrapper.findAll('.dtm-validation__reference')
    expect(links).toHaveLength(2)
    expect(links[0]?.attributes('href')).toBe('https://example.com/a')
    expect(links[1]?.attributes('href')).toBe('https://example.com/c')
  })

  it('reads set B when setId is "B"', () => {
    mockSetB.value = {
      validation: [issueFixture({ reference: 'https://example.com/b' })],
    }
    const wrapper = mount(ValidationPanel, {
      props: { setId: 'B', open: true },
    })
    expect(wrapper.find('.dtm-validation__reference').attributes('href')).toBe(
      'https://example.com/b'
    )
  })
})
