<script setup lang="ts">
/**
 * ValidationPanel — list of validation issues for the active set.
 *
 * Shown after the visual gallery (per the PRD). Toggled open/closed via a
 * prop; the parent (Toolbar) controls visibility. Issues are grouped by
 * severity — errors first, then warnings — and each row shows path, code,
 * and message.
 *
 * Reads from useGallery's browseSet (the single-set browse case). The
 * compare case doesn't surface a per-set validation panel in v1; that's a
 * future enhancement.
 */

import { computed } from 'vue'
import { useGallery } from '@/composables/useGallery'
import type { ValidationIssue } from '@/types/validation'

const props = defineProps<{
  /** Whether the panel is expanded. When false, only the header summary shows. */
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { browseSet } = useGallery()

const issues = computed<ValidationIssue[]>(() => browseSet.value?.validation ?? [])

const errorCount = computed(
  () => issues.value.filter((i) => i.severity === 'error').length
)
const warningCount = computed(
  () => issues.value.filter((i) => i.severity === 'warning').length
)

/** Issues sorted: errors first, then warnings, then by path. */
const sortedIssues = computed<ValidationIssue[]>(() => {
  const sevRank: Record<'error' | 'warning', number> = { error: 0, warning: 1 }
  return [...issues.value].sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) {
      return sevRank[a.severity] - sevRank[b.severity]
    }
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  })
})

function toggle(): void {
  emit('update:open', !props.open)
}
</script>

<template>
  <section class="dtv-validation" :class="{ 'dtv-validation--open': open }">
    <button
      type="button"
      class="dtv-validation__header"
      :aria-expanded="open"
      aria-controls="dtv-validation-body"
      @click="toggle"
    >
      <span class="dtv-validation__title">Validation</span>
      <span v-if="errorCount > 0" class="dtv-validation__badge dtv-validation__badge--error">
        {{ errorCount }} error{{ errorCount === 1 ? '' : 's' }}
      </span>
      <span v-if="warningCount > 0" class="dtv-validation__badge dtv-validation__badge--warning">
        {{ warningCount }} warning{{ warningCount === 1 ? '' : 's' }}
      </span>
      <span v-if="issues.length === 0" class="dtv-validation__clean">
        No issues
      </span>
      <span class="dtv-validation__chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <ol v-if="open" id="dtv-validation-body" class="dtv-validation__list">
      <li v-if="sortedIssues.length === 0" class="dtv-validation__empty">
        Loaded tokens passed all checks.
      </li>
      <li
        v-for="(issue, idx) in sortedIssues"
        :key="`${issue.path}-${issue.code}-${idx}`"
        class="dtv-validation__row"
        :class="`dtv-validation__row--${issue.severity}`"
      >
        <span class="dtv-validation__severity" :aria-label="issue.severity">
          {{ issue.severity === 'error' ? '⛔' : '⚠' }}
        </span>
        <code class="dtv-validation__path">{{ issue.path }}</code>
        <span class="dtv-validation__code">{{ issue.code }}</span>
        <span class="dtv-validation__message">{{ issue.message }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.dtv-validation {
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
  background-color: var(--dtv-color-surface);
  overflow: hidden;
}

.dtv-validation__header {
  display: flex;
  align-items: center;
  gap: var(--dtv-spacing-sm);
  width: 100%;
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  background: none;
  border: none;
  text-align: left;
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text);
}

.dtv-validation__header:hover {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-validation__title {
  font-weight: var(--dtv-font-weight-semibold);
}

.dtv-validation__badge {
  padding: 1px var(--dtv-spacing-xs);
  border-radius: var(--dtv-radius-sm);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
}

.dtv-validation__badge--error {
  background-color: var(--dtv-color-error);
  color: #fff;
}

.dtv-validation__badge--warning {
  background-color: var(--dtv-color-warning);
  color: #fff;
}

.dtv-validation__clean {
  color: var(--dtv-color-success);
  font-size: var(--dtv-font-size-sm);
}

.dtv-validation__chevron {
  margin-left: auto;
  color: var(--dtv-color-text-subtle);
}

.dtv-validation__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--dtv-color-border);
  max-height: 320px;
  overflow-y: auto;
}

.dtv-validation__empty {
  padding: var(--dtv-spacing-md);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}

.dtv-validation__row {
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  gap: var(--dtv-spacing-xs);
  align-items: baseline;
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-md);
  border-bottom: 1px solid var(--dtv-color-border);
  font-size: var(--dtv-font-size-sm);
}

.dtv-validation__row:last-child {
  border-bottom: none;
}

.dtv-validation__row--error {
  background-color: var(--dtv-color-surface);
}

.dtv-validation__row--warning {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-validation__severity {
  font-size: var(--dtv-font-size-md);
}

.dtv-validation__path {
  font-family: var(--dtv-font-family-mono);
  color: var(--dtv-color-text);
  word-break: break-all;
}

.dtv-validation__code {
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
}

.dtv-validation__message {
  color: var(--dtv-color-text-muted);
}
</style>
