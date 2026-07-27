<script setup lang="ts">
/**
 * AppHeader — top bar with the project name and tagline.
 *
 * Purely presentational. The repo link is a placeholder until the README
 * ships (Phase 13); it points at the canonical GitHub URL regardless.
 */

const REPO_URL = 'https://github.com/pattespatte/token-mapper'
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

.dtv-header__tagline {
  margin: 0;
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}
</style>
