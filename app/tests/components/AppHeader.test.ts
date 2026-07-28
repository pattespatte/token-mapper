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
 * The toggle cycles light → dark → system → light. The icon + aria-label
 * always describe the *target* (the mode the next click switches to), not
 * the current mode:
 *   - currently light   → moon icon,   "switch to dark"
 *   - currently dark    → contrast,    "switch to system"
 *   - currently system  → sun icon,    "switch to light"
 *
 * There's no `aria-pressed` (binary, can't represent three states) — the
 * descriptive aria-label is the accessible name instead.
 */

describe('AppHeader', () => {
  const { theme, setTheme } = useTheme()

  beforeEach(() => {
    setTheme('light')
  })

  it('renders the theme toggle button', () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtm-header__theme-toggle')
    expect(toggle.exists()).toBe(true)
    // No aria-pressed: it's binary and can't represent three modes. The
    // descriptive aria-label conveys state to assistive tech instead.
    expect(toggle.attributes('aria-pressed')).toBeUndefined()
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

  it('clicking cycles light → dark → system → light', async () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtm-header__theme-toggle')
    expect(theme.value).toBe('light')

    await toggle.trigger('click')
    expect(theme.value).toBe('dark')

    await toggle.trigger('click')
    expect(theme.value).toBe('system')

    await toggle.trigger('click')
    // Wraps back to the start.
    expect(theme.value).toBe('light')
  })

  it('the icon reflects the target mode at each step of the cycle', async () => {
    const wrapper = mount(AppHeader)
    setTheme('light')
    // light → target dark → moon (arc command, no <circle>).
    expect(wrapper.find('svg').html()).toMatch(/A\d/)

    await wrapper.find('.dtm-header__theme-toggle').trigger('click')
    // dark → target system → contrast glyph (a <path> with a fill, no arc 'A…').
    const systemIcon = wrapper.find('svg').html()
    expect(systemIcon).toMatch(/fill="currentColor"/)
    expect(systemIcon).not.toMatch(/A\d/)

    await wrapper.find('.dtm-header__theme-toggle').trigger('click')
    // system → target light → sun (<circle> present).
    expect(wrapper.find('svg').html()).toMatch(/<circle/)
  })

  it('the aria-label names the mode you will switch to', async () => {
    const wrapper = mount(AppHeader)
    const toggle = wrapper.find('.dtm-header__theme-toggle')

    // light → offers "switch to dark".
    expect(toggle.attributes('aria-label')).toBe('Switch to dark theme')

    await toggle.trigger('click')
    // dark → offers "switch to system".
    expect(toggle.attributes('aria-label')).toBe('Switch to system theme')

    await toggle.trigger('click')
    // system → offers "switch to light".
    expect(toggle.attributes('aria-label')).toBe('Switch to light theme')
  })

  it('renders the project name and tagline', () => {
    const wrapper = mount(AppHeader)
    expect(wrapper.find('.dtm-header__name').text()).toBe('Design Token Mapper')
    expect(wrapper.find('.dtm-header__tagline').text()).toMatch(/W3C design tokens/)
  })
})
