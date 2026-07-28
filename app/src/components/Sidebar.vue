<script setup lang="ts">
/**
 * Sidebar — collapsible category navigation (browse mode only).
 *
 * Two visual states driven by useSidebar.collapsed:
 *
 *   Expanded (default): a header row with a chevron toggle, then either
 *   the category list, the no-set prompt, or the compare-mode note.
 *
 *   Collapsed: a thin vertical rail showing only the toggle (rotated).
 *   Content stays in the DOM but is hidden, so screen-reader users can
 *   still navigate it if they choose.
 *
 * Three content states inside the collapsible region (unchanged from
 * before the collapse feature):
 *   - Compare mode: a note pointing users at the FilterBar buckets.
 *   - Browse mode with a set loaded: the category list.
 *   - No set loaded: prompt to load one.
 *
 * On narrow viewports the Sidebar is hidden entirely by App.vue's
 * responsive CSS, so collapse doesn't apply there.
 */

import { computed } from 'vue'
import { useGallery } from '@/composables/useGallery'
import { useTokenSets } from '@/composables/useTokenSets'
import { useSidebar } from '@/composables/useSidebar'

const { categories, activeCategory, browseSet } = useGallery()
const { isComparing } = useTokenSets()
const { collapsed, toggle } = useSidebar()

function selectCategory(name: string): void {
  activeCategory.value = name
}

/** Accessible label for the toggle button — describes what it does. */
const toggleLabel = computed(() =>
  collapsed.value ? 'Expand categories' : 'Collapse categories'
)
</script>

<template>
  <nav class="dtm-sidebar" :class="{ 'dtm-sidebar--collapsed': collapsed }" aria-label="Token categories">
    <!-- Toggle: always visible, in both states. Lives outside the
         collapsible content region so it remains interactive when collapsed. -->
    <button
      type="button"
      class="dtm-sidebar__toggle"
      :class="{ 'dtm-sidebar__toggle--collapsed': collapsed }"
      :aria-expanded="!collapsed"
      aria-controls="dtm-sidebar-content"
      :aria-label="toggleLabel"
      :title="toggleLabel"
      @click="toggle"
    >
      <span class="dtm-sidebar__chevron" aria-hidden="true">‹</span>
    </button>

    <!-- Collapsible content. Stays in the DOM; hidden visually when collapsed. -->
    <div
      id="dtm-sidebar-content"
      class="dtm-sidebar__content"
      :class="{ 'dtm-sidebar__content--hidden': collapsed }"
    >
      <h2 class="dtm-sidebar__heading">Categories</h2>

      <p v-if="isComparing" class="dtm-sidebar__note">
        Comparing two sets. Categories are browse-only — switch back to a
        single set to use them, or use the
        <strong>Matching / Changed / Missing / Extra</strong> filters above
        the comparison grid.
      </p>

      <p v-else-if="browseSet === null" class="dtm-sidebar__empty">
        No set loaded. Click <strong>Load demo</strong> or drop a JSON file.
      </p>

      <ul v-else class="dtm-sidebar__list">
        <li v-for="cat in categories" :key="cat.name">
          <button
            type="button"
            class="dtm-sidebar__item"
            :class="{ 'dtm-sidebar__item--active': activeCategory === cat.name }"
            :aria-pressed="activeCategory === cat.name"
            @click="selectCategory(cat.name)"
          >
            <span class="dtm-sidebar__name">{{ cat.name }}</span>
            <span class="dtm-sidebar__count">{{ cat.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.dtm-sidebar {
  /* Expanded: vertical stack — toggle on top, content below. */
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  height: 100%;
  padding: var(--dtm-spacing-md);
}

.dtm-sidebar--collapsed {
  /* Collapsed: thin rail. Center the toggle vertically; no horizontal
     padding so the rail is exactly the COLLAPSED_WIDTH from useSidebar. */
  align-items: center;
  justify-content: flex-start;
  padding: var(--dtm-spacing-xs) 0;
}

.dtm-sidebar__toggle {
  /* Toggle button fills its row when expanded (so the whole header strip
     is clickable) and becomes a square icon button when collapsed. */
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  background: none;
  border: none;
  color: var(--dtm-color-text-subtle);
  font-size: var(--dtm-font-size-md);
  cursor: pointer;
  border-radius: var(--dtm-radius-sm);
}

.dtm-sidebar__toggle:hover {
  color: var(--dtm-color-accent);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-sidebar__toggle--collapsed {
  /* Square icon button in the rail. */
  align-self: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
}

.dtm-sidebar__chevron {
  /* Expanded: points left (‹) to indicate "collapse to the left".
     Collapsed: rotate 180° so it points right (›), indicating "expand". */
  display: inline-block;
  font-size: var(--dtm-font-size-lg);
  line-height: 1;
  transition: transform 0.15s ease;
}

@media (prefers-reduced-motion: reduce) {
  .dtm-sidebar__chevron {
    transition: none;
  }
}

.dtm-sidebar__toggle--collapsed .dtm-sidebar__chevron {
  transform: rotate(180deg);
}

.dtm-sidebar__content {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  /* Visibility transitions with the grid width so content fades out as
     the rail collapses, not before. */
  transition: visibility 0s linear 0.15s;
}

.dtm-sidebar__content--hidden {
  /* Hidden visually but kept in the DOM for SR users. Pointer-events
     none so the collapsed rail doesn't intercept clicks on hidden
     buttons. */
  visibility: hidden;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .dtm-sidebar__content {
    transition: none;
  }
}

.dtm-sidebar__heading {
  margin: 0 0 var(--dtm-spacing-xs) 0;
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtm-sidebar__empty,
.dtm-sidebar__note {
  margin: 0;
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  line-height: 1.4;
}

.dtm-sidebar__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dtm-sidebar__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-sm);
  background: none;
  border: none;
  border-radius: var(--dtm-radius-sm);
  color: var(--dtm-color-text);
  font-size: var(--dtm-font-size-sm);
  text-align: left;
  cursor: pointer;
}

.dtm-sidebar__item:hover:not(.dtm-sidebar__item--active) {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1).
     Excludes --active, whose accent-on-muted treatment shouldn't be overridden. */
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-sidebar__item--active {
  background-color: var(--dtm-color-accent-muted);
  color: var(--dtm-color-accent);
  font-weight: var(--dtm-font-weight-medium);
}

.dtm-sidebar__name {
  font-family: var(--dtm-font-family-mono);
}

.dtm-sidebar__count {
  color: var(--dtm-color-text-subtle);
  font-size: var(--dtm-font-size-sm);
}

.dtm-sidebar__item--active .dtm-sidebar__count {
  color: var(--dtm-color-accent);
}
</style>
