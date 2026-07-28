import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from '@/components/AppHeader.vue'
import { useTheme } from '@/composables/useTheme'

/**
 * AppHeader smoke test.
 *
 * Uses the real `useTheme` singleton rather than mocking it — that way the
 * test catches wiring errors between the toggle button and the composable's
 * `toggleTheme`/`theme` exports. The singleton's module-scoped state is
 * reset in `beforeEach` to prevent test-order coupling (the same caveat
 * documented in useTheme.test.ts).
 *
 * Covers the whole-app theme toggle:
 *   - Renders the button with the correct initial aria-pressed.
 *   - Clicking the button flips aria-pressed (light ↔ dark).
 *   - The toggle label updates to name the action you'll switch *to*.
 *   - The sun/moon SVG swaps with the theme (moon in light, sun in dark).
 */

describe('AppHeader', () => {
  const { theme, setTheme } = useTheme()

  beforeEach(() => {
    setTheme('light')
  })

  it('renders the theme toggle button with aria-pressed=false when light', () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtv-header__theme-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-pressed')).toBe('false')
  })

  it('renders the moon SVG in light mode (target = dark)', () => {
    const wrapper = mount(AppHeader)
    // Exactly one SVG; it's the moon (path contains an SVG arc command 'A').
    expect(wrapper.findAll('svg')).toHaveLength(1)
    const svg = wrapper.find('svg')
    // SVG arc commands look like 'A9 9 0 …' — the 'A' is immediately followed
    // by a digit (no whitespace). The sun's first shape is <circle>, no 'A'.
    expect(svg.html()).toMatch(/A\d/) // arc command present → moon
  })

  it('clicking the toggle flips theme to dark and aria-pressed to true', async () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtv-header__theme-toggle')
    expect(theme.value).toBe('light')

    await toggle.trigger('click')

    expect(theme.value).toBe('dark')
    expect(toggle.attributes('aria-pressed')).toBe('true')
  })

  it('second click flips back to light and restores the moon icon', async () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtv-header__theme-toggle')

    await toggle.trigger('click')
    expect(theme.value).toBe('dark')
    // In dark mode → sun (circle element present).
    expect(wrapper.find('svg').html()).toMatch(/<circle/)

    await toggle.trigger('click')
    expect(theme.value).toBe('light')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    // Back to moon (arc command present, no <circle>).
    expect(wrapper.find('svg').html()).not.toMatch(/<circle/)
  })

  it('the aria-label names the action you will switch to', async () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtv-header__theme-toggle')

    // In light mode → label offers "switch to dark".
    expect(toggle.attributes('aria-label')).toContain('dark')
    expect(toggle.attributes('aria-label')).not.toContain('light')

    await toggle.trigger('click')

    // In dark mode → label offers "switch to light".
    expect(toggle.attributes('aria-label')).toContain('light')
    expect(toggle.attributes('aria-label')).not.toContain('dark')
  })

  it('renders the project name and tagline', () => {
    const wrapper = mount(AppHeader)
    expect(wrapper.find('.dtv-header__name').text()).toBe('Design Token Mapper')
    expect(wrapper.find('.dtv-header__tagline').text()).toMatch(/W3C design tokens/)
  })
})
