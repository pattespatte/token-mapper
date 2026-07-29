/**
 * useValidationPanel — shared open/closed state for the validation panels.
 *
 * The two `ValidationPanel` instances (Set A / Set B) are toggled via a
 * `v-model:open` binding. Originally that state lived as private refs inside
 * `App.vue`, which was fine while only the header button could open a panel.
 *
 * Token cards now carry a "jump to validation" affordance: clicking a card's
 * issue indicator should open the relevant panel and scroll to it, no matter
 * where in the component tree that card lives. Lifting the open state into a
 * module-scoped singleton (matching the codebase's no-Pinia convention) lets
 * any component drive the panels without prop-drilling or an event bus.
 *
 * Singleton semantics mirror `useGallery` / `useTokenSets`: the refs are
 * declared at module scope and every `useValidationPanel()` call returns the
 * same three handles, so the panels and the cards stay in lockstep.
 */

import { nextTick, ref, type Ref } from 'vue'

/** Which set id a validation panel belongs to. Mirrors `TokenSet['id']`. */
type SetId = 'A' | 'B'

/**
 * Open state for each panel. Module-scoped so all callers share one source of
 * truth — `App.vue` binds these to the panels' `v-model:open`; cards flip them
 * via {@link openForValidation}.
 */
const openA: Ref<boolean> = ref(false)
const openB: Ref<boolean> = ref(false)

/** HTML id applied to each `ValidationPanel`'s outer `<section>` (stable scroll target). */
const panelElementId = (setId: SetId): string => `dtm-validation-${setId}`

/**
 * Open the panel for the given set and scroll it into view.
 *
 * The scroll happens after `nextTick` so the panel body has rendered (it's
 * `v-if="open"`, so it doesn't exist until `open` flips true). In jsdom there
 * is no layout, so `scrollIntoView` is a no-op there — the guard on the element
 * keeps the call safe regardless of environment.
 *
 * Always sets `open` true even if the element can't be found (e.g. the panel
 * isn't mounted because its set was cleared in the same tick); opening is the
 * user-visible intent, the scroll is best-effort.
 */
async function openForValidation(setId: SetId): Promise<void> {
  const target = setId === 'A' ? openA : openB
  target.value = true
  await nextTick()
  document.getElementById(panelElementId(setId))?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

/** Exposed singleton handles. */
export function useValidationPanel(): {
  openA: Ref<boolean>
  openB: Ref<boolean>
  openForValidation: (setId: SetId) => Promise<void>
} {
  return { openA, openB, openForValidation }
}
