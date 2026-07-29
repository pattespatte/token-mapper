import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ResolvedToken, ValidationIssue } from '@dtcg-mapper/core'
import TokenCard from '@/components/TokenCard.vue'

/**
 * TokenCard tests.
 *
 * Focus: the validation indicator added to surface per-token validation
 * problems (e.g. a `dimension` value stored as a bare number). The indicator
 * has three states we cover here:
 *   - no issues → no indicator, no stripe modifier class,
 *   - warning issues → amber stripe (`.dtm-card--has-warning`) + ⚠ button,
 *   - error issues   → red   stripe (`.dtm-card--has-error`)   + ⛔ button,
 * and the button emits `jump-to-validation` on click and carries the issue
 * message in its `title`.
 *
 * Card selection / copy behaviour is unchanged and covered elsewhere; these
 * tests pin the indicator contract only.
 */

/** Minimal valid token fixture. Only the fields TokenCard reads are needed. */
function tokenFixture(overrides: Partial<ResolvedToken> = {}): ResolvedToken {
  return {
    path: 'radius.md',
    segments: ['radius', 'md'],
    rawValue: 8,
    type: 'dimension',
    resolvedValue: 8,
    aliasChain: [],
    hasError: false,
    ...overrides,
  }
}

function issueFixture(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    path: 'radius.md',
    severity: 'warning',
    code: 'VALUE_SHAPE',
    message: 'dimension value missing a unit',
    ...overrides,
  }
}

describe('TokenCard — validation indicator', () => {
  it('renders no indicator and no stripe class when issues is omitted', () => {
    const wrapper = mount(TokenCard, { props: { token: tokenFixture() } })
    expect(wrapper.find('.dtm-card__indicator').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('dtm-card--has-issue')
    expect(wrapper.classes()).not.toContain('dtm-card--has-warning')
    expect(wrapper.classes()).not.toContain('dtm-card--has-error')
  })

  it('renders no indicator when issues is an empty array', () => {
    const wrapper = mount(TokenCard, {
      props: { token: tokenFixture(), issues: [] },
    })
    expect(wrapper.find('.dtm-card__indicator').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('dtm-card--has-issue')
  })

  it('renders an amber stripe and ⚠ button for warning issues', () => {
    const wrapper = mount(TokenCard, {
      props: { token: tokenFixture(), issues: [issueFixture()] },
    })
    expect(wrapper.classes()).toContain('dtm-card--has-issue')
    expect(wrapper.classes()).toContain('dtm-card--has-warning')
    expect(wrapper.classes()).not.toContain('dtm-card--has-error')
    const btn = wrapper.find('.dtm-card__indicator')
    expect(btn.exists()).toBe(true)
    expect(btn.classes()).toContain('dtm-card__indicator--warning')
    expect(btn.text()).toBe('⚠')
  })

  it('renders a red stripe and ⛔ button when any issue is an error', () => {
    const wrapper = mount(TokenCard, {
      props: {
        token: tokenFixture(),
        issues: [issueFixture(), issueFixture({ severity: 'error', code: 'BAD' })],
      },
    })
    // Error wins over warning.
    expect(wrapper.classes()).toContain('dtm-card--has-error')
    expect(wrapper.classes()).not.toContain('dtm-card--has-warning')
    const btn = wrapper.find('.dtm-card__indicator')
    expect(btn.classes()).toContain('dtm-card__indicator--error')
    expect(btn.text()).toBe('⛔')
  })

  it('puts the issue message in the indicator title', () => {
    const wrapper = mount(TokenCard, {
      props: {
        token: tokenFixture(),
        issues: [issueFixture({ message: 'expected a length unit' })],
      },
    })
    expect(wrapper.find('.dtm-card__indicator').attributes('title')).toContain(
      'expected a length unit'
    )
  })

  it('emits jump-to-validation when the indicator is clicked', async () => {
    const wrapper = mount(TokenCard, {
      props: { token: tokenFixture(), issues: [issueFixture()] },
    })
    await wrapper.find('.dtm-card__indicator').trigger('click')
    expect(wrapper.emitted('jump-to-validation')).toHaveLength(1)
  })

  it('does not emit select when the indicator is clicked (stop propagation)', async () => {
    const wrapper = mount(TokenCard, {
      props: { token: tokenFixture(), issues: [issueFixture()] },
    })
    await wrapper.find('.dtm-card__indicator').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
