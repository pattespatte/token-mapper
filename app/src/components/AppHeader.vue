<script setup lang="ts">
/**
 * AppHeader — top bar with the project name, tagline, repo link, and the
 * theme toggle.
 *
 * The theme toggle flips the whole app between light and dark via `useTheme`.
 * It overrides the OS `prefers-color-scheme` setting: once the user picks,
 * that choice wins on every visit (persisted to localStorage). The icon
 * shows the state you'll switch *to* — moon when light (click for dark),
 * sun when dark (click for light) — matching the dynamic aria-label.
 */

import { useTheme } from '@/composables/useTheme'

const REPO_URL = 'https://github.com/pattespatte/token-mapper'
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <header class="dtv-header">
    <div class="dtv-header__brand">
      <span class="dtv-header__name">Design Token Mapper</span>
      <a
        :href="REPO_URL"
        class="dtv-header__repo"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub"
      >GitHub</a>
      <!--
        Icon = target state (what you'll switch to). Moon in light mode means
        "click for dark"; sun in dark mode means "click for light". The
        aria-label spells out the action so it's unambiguous for SR users.
      -->
      <button
        type="button"
        class="dtv-header__theme-toggle"
        :aria-pressed="theme === 'dark'"
        :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
        :title="`Theme: ${theme}. Click to switch.`"
        @click="toggleTheme"
      >
        <!-- Inline SVG keeps the icon crisp at small sizes and inherits
             currentColor. Emoji (☀️/🌙) render inconsistently across
             platforms; a vector glyph is more reliable. -->
        <svg
          v-if="theme === 'light'"
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
    <p class="dtv-header__tagline">
      Visually browse and compare W3C design tokens, in your browser.
    </p>
  </header>
</template>

<style scoped>
.dtv-header {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-xs);
  padding: var(--dtv-spacing-sm) var(--dtv-spacing-lg);
  border-bottom: 1px solid var(--dtv-color-border);
  background-color: var(--dtv-color-surface);
}

.dtv-header__brand {
  display: flex;
  align-items: baseline;
  gap: var(--dtv-spacing-sm);
}

.dtv-header__name {
  font-size: var(--dtv-font-size-lg);
  font-weight: var(--dtv-font-weight-semibold);
  color: var(--dtv-color-text);
}

.dtv-header__repo {
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
  text-decoration: none;
}

.dtv-header__repo:hover {
  color: var(--dtv-color-accent);
  text-decoration: underline;
}

.dtv-header__theme-toggle {
  margin-left: auto;
  padding: 2px var(--dtv-spacing-xs);
  font-size: var(--dtv-font-size-md);
  line-height: 1;
  color: var(--dtv-color-text-subtle);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  cursor: pointer;
}

.dtv-header__theme-toggle:hover {
  color: var(--dtv-color-text);
  border-color: var(--dtv-color-border-strong);
}

.dtv-header__theme-toggle:focus-visible {
  outline: 2px solid var(--dtv-color-accent);
  outline-offset: 2px;
}

.dtv-header__theme-toggle[aria-pressed='true'] {
  color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-header__tagline {
  margin: 0;
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}
</style>
