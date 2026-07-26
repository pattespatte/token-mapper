import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBar from '@/components/SearchBar.vue'
import { useSearch } from '@/composables/useSearch'

/**
 * SearchBar smoke test.
 *
 * The component is a thin wrapper around `useSearch`'s shared query ref;
 * these tests verify the wiring (typing updates the singleton, clear button
 * empties it, Esc clears) rather than the predicate logic itself (covered in
 * tests/composables/useSearch.test.ts).
 */
describe('SearchBar', () => {
  beforeEach(() => {
    useSearch().clearInput()
  })

  it('mounts with an empty input', () => {
    const wrapper = mount(SearchBar)
    const input = wrapper.get('input[type="search"]')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('typing updates the shared query ref', async () => {
    const wrapper = mount(SearchBar)
    const input = wrapper.get('input[type="search"]')
    await input.setValue('indigo')
    expect(useSearch().query.value).toBe('indigo')
  })

  it('clear button empties the query and hides itself when empty', async () => {
    const wrapper = mount(SearchBar)
    await wrapper.get('input[type="search"]').setValue('something')
    expect(wrapper.find('.dtv-searchbar__clear').exists()).toBe(true)

    await wrapper.get('.dtv-searchbar__clear').trigger('click')
    expect(useSearch().query.value).toBe('')
    expect(wrapper.find('.dtv-searchbar__clear').exists()).toBe(false)
  })

  it('Esc clears the query', async () => {
    const wrapper = mount(SearchBar)
    await wrapper.get('input[type="search"]').setValue('keep me')
    await wrapper.get('input[type="search"]').trigger('keydown', { key: 'Escape' })
    expect(useSearch().query.value).toBe('')
  })

  it('renders an accessible label and placeholder', () => {
    const wrapper = mount(SearchBar)
    // Label is wired via for/id; both should reference dtv-searchbar-input.
    expect(wrapper.get('label').attributes('for')).toBe('dtv-searchbar-input')
    expect(wrapper.get('input').attributes('id')).toBe('dtv-searchbar-input')
    expect(wrapper.get('input').attributes('placeholder')).toContain('Search')
  })
})
