<script setup lang="ts">
/**
 * AppHeader — top bar with the project name, tagline, repo link, and the
 * theme toggle.
 *
 * The toggle cycles three modes via `useTheme`:
 *   `light → dark → system → light` (wraps).
 *
 * - `light` / `dark` override the OS `prefers-color-scheme` (and persist).
 * - `system` hands control back to the browser — the app follows the OS
 *   setting live.
 *
 * The icon shows the mode you'll switch *to* on the next click (the target),
 * matching the dynamic `aria-label`:
 *   - currently light   → moon      (click for dark)
 *   - currently dark    → contrast  (click for system)
 *   - currently system  → sun       (click for light)
 *
 * There's no `aria-pressed` — it's binary and can't represent three states.
 * The descriptive `aria-label` conveys both the current mode and the next
 * action to assistive tech.
 */

import { computed } from 'vue'
import { useTheme, type Theme } from '@/composables/useTheme'

const REPO_URL = 'https://github.com/pattespatte/token-mapper'
const { theme, toggleTheme } = useTheme()

/** The cycle order — kept in sync with `useTheme.CYCLE`. */
const CYCLE: readonly Theme[] = ['light', 'dark', 'system']

/** The mode the next click will activate (drives the icon + aria-label). */
const nextTheme = computed<Theme>(
  () => CYCLE[(CYCLE.indexOf(theme.value) + 1) % CYCLE.length]!
)

/** Human label for the current mode, shown in the tooltip. */
const currentLabel = computed(() => {
  if (theme.value === 'system') return 'system (follows OS)'
  return theme.value
})
</script>

<template>
  <header class="dtm-header">
    <div class="dtm-header__brand">
      <span class="dtm-header__name">Design Token Mapper</span>
      <a
        :href="REPO_URL"
        class="dtm-header__repo"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub"
      >GitHub</a>
      <!--
        Icon = target state (the mode the next click switches to). The
        aria-label spells out the action so it's unambiguous for SR users.
        There's no aria-pressed: it's binary and can't represent three modes.
      -->
      <button
        type="button"
        class="dtm-header__theme-toggle"
        :aria-label="`Switch to ${nextTheme} theme`"
        :title="`Theme: ${currentLabel}. Click to switch.`"
        @click="toggleTheme"
      >
        <!-- Inline SVG keeps the icon crisp at small sizes and inherits
             currentColor. Emoji (☀️/🌙) render inconsistently across
             platforms; a vector glyph is more reliable. -->
        <svg
          v-if="nextTheme === 'dark'"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Moon: click to enter dark -->
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          v-else-if="nextTheme === 'system'"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Contrast circle (half-filled): click to follow the OS -->
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
          <path d="M12 2v20a10 10 0 0 0 0-20z" fill="currentColor" stroke="none" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Sun: click to return to light -->
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>
    </div>
    <p class="dtm-header__tagline">
      Visually browse and compare W3C design tokens, in your browser.
    </p>
  </header>
</template>

<style scoped>
.dtm-header {
  display: flex;
  flex-direction: column;
  gap: var(--dtm-spacing-xs);
  padding: var(--dtm-spacing-sm) var(--dtm-spacing-lg);
  border-bottom: 1px solid var(--dtm-color-border);
  background-color: var(--dtm-color-surface);
}

.dtm-header__brand {
  display: flex;
  align-items: baseline;
  gap: var(--dtm-spacing-sm);
}

.dtm-header__name {
  font-size: var(--dtm-font-size-lg);
  font-weight: var(--dtm-font-weight-semibold);
  color: var(--dtm-color-text);
}

.dtm-header__repo {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  text-decoration: none;
}

.dtm-header__repo:hover {
  color: var(--dtm-color-accent);
  text-decoration: underline;
}

.dtm-header__theme-toggle {
  margin-left: auto;
  padding: 2px var(--dtm-spacing-xs);
  font-size: var(--dtm-font-size-md);
  line-height: 1;
  color: var(--dtm-color-text-subtle);
  background: none;
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-sm);
  cursor: pointer;
}

.dtm-header__theme-toggle:hover {
  color: var(--dtm-color-text);
  border-color: var(--dtm-color-border-strong);
}

.dtm-header__theme-toggle:focus-visible {
  outline: 2px solid var(--dtm-color-accent);
  outline-offset: 2px;
}

.dtm-header__tagline {
  margin: 0;
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}
</style>
