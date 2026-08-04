<script setup lang="ts">
/**
 * ValidationPanel — list of validation issues for one loaded set.
 *
 * Shown after the visual gallery (per the PRD). Toggled open/closed via a
 * prop; the parent controls visibility. Issues are grouped by severity —
 * errors first, then warnings — and each row shows path, code, message, and
 * (when the issue carries a `reference`) a "Spec ↗" link into the W3C rule.
 *
 * Reads the set named by the `setId` prop directly from `useTokenSets`, so
 * the same panel serves both modes:
 *   - Browse mode: App.vue renders one instance for whichever set is loaded.
 *   - Compare mode: App.vue renders one instance per loaded set (A | B),
 *     side by side, so each set's validation reads independently.
 */

import { computed } from 'vue'
import { useTokenSets } from '@/composables/useTokenSets'
import type { ValidationIssue } from '@dtcg-mapper/core'

const props = defineProps<{
  /** Which slot's issues to show. */
  setId: 'A' | 'B'
  /** Whether the panel is expanded. When false, only the header summary shows. */
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { setA, setB } = useTokenSets()

const activeSet = computed(() => (props.setId === 'A' ? setA.value : setB.value))

const setLabel = computed(() => (props.setId === 'A' ? 'Set A' : 'Set B'))

const issues = computed<ValidationIssue[]>(() => activeSet.value?.validation ?? [])

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
  <section
    :id="`dtm-validation-${setId}`"
    class="dtm-validation"
    :class="{ 'dtm-validation--open': open }"
  >
    <button
      type="button"
      class="dtm-validation__header"
      :aria-expanded="open"
      aria-controls="dtm-validation-body"
      @click="toggle"
    >
      <span class="dtm-validation__title">Validation <span class="dtm-validation__set">· {{ setLabel }}</span></span>
      <span v-if="errorCount > 0" class="dtm-validation__badge dtm-validation__badge--error">
        {{ errorCount }} error{{ errorCount === 1 ? '' : 's' }}
      </span>
      <span v-if="warningCount > 0" class="dtm-validation__badge dtm-validation__badge--warning">
        {{ warningCount }} warning{{ warningCount === 1 ? '' : 's' }}
      </span>
      <span v-if="issues.length === 0" class="dtm-validation__clean">
        No issues
      </span>
      <span class="dtm-validation__chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <ol v-if="open" id="dtm-validation-body" class="dtm-validation__list">
      <li v-if="sortedIssues.length === 0" class="dtm-validation__empty">
        Loaded tokens passed all checks.
      </li>
      <li
        v-for="(issue, idx) in sortedIssues"
        :key="`${issue.path}-${issue.code}-${idx}`"
        class="dtm-validation__row"
        :class="`dtm-validation__row--${issue.severity}`"
      >
        <span class="dtm-validation__severity" :aria-label="issue.severity">
          {{ issue.severity === 'error' ? '⛔' : '⚠' }}
        </span>
        <code class="dtm-validation__path">{{ issue.path }}</code>
        <span class="dtm-validation__code">{{ issue.code }}</span>
        <span class="dtm-validation__message">{{ issue.message }}</span>
        <a
          v-if="issue.reference"
          class="dtm-validation__reference"
          :href="issue.reference"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`Read the spec for ${issue.code}`"
          >Spec ↗</a
        >
      </li>
    </ol>
  </section>
</template>

<style scoped>
.dtm-validation {
  border: 1px solid var(--dtm-color-border);
  border-radius: var(--dtm-radius-md);
  background-color: var(--dtm-color-surface);
  overflow: hidden;
}

.dtm-validation__header {
  display: flex;
  align-items: center;
  gap: var(--dtm-spacing-sm);
  width: 100%;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-md);
  background: none;
  border: none;
  text-align: left;
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text);
}

.dtm-validation__header:hover {
  /* Explicit color on hover for unambiguous contrast (mirrors 47026f1). */
  color: var(--dtm-color-text);
  background-color: var(--dtm-color-surface-muted);
}

.dtm-validation__title {
  font-weight: var(--dtm-font-weight-semibold);
}

/* "· Set A/B" suffix — secondary weight so "Validation" leads visually. */
.dtm-validation__set {
  font-weight: var(--dtm-font-weight-regular);
  color: var(--dtm-color-text-subtle);
}

.dtm-validation__badge {
  padding: 1px var(--dtm-spacing-xs);
  border-radius: var(--dtm-radius-sm);
  font-size: var(--dtm-font-size-sm);
  font-weight: var(--dtm-font-weight-medium);
}

.dtm-validation__badge--error {
  background-color: var(--dtm-color-error);
  color: #fff;
}

.dtm-validation__badge--warning {
  background-color: var(--dtm-color-warning);
  color: #fff;
}

.dtm-validation__clean {
  color: var(--dtm-color-success);
  font-size: var(--dtm-font-size-sm);
}

.dtm-validation__chevron {
  margin-left: auto;
  color: var(--dtm-color-text-subtle);
}

.dtm-validation__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--dtm-color-border);
  max-height: 320px;
  overflow-y: auto;
}

.dtm-validation__empty {
  padding: var(--dtm-spacing-md);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}

.dtm-validation__row {
  display: grid;
  grid-template-columns: auto auto auto 1fr auto;
  gap: var(--dtm-spacing-xs);
  align-items: baseline;
  padding: var(--dtm-spacing-xs) var(--dtm-spacing-md);
  border-bottom: 1px solid var(--dtm-color-border);
  font-size: var(--dtm-font-size-sm);
}

.dtm-validation__row:last-child {
  border-bottom: none;
}

.dtm-validation__row--error {
  background-color: var(--dtm-color-surface);
}

.dtm-validation__row--warning {
  background-color: var(--dtm-color-surface-muted);
}

.dtm-validation__severity {
  font-size: var(--dtm-font-size-md);
}

.dtm-validation__path {
  font-family: var(--dtm-font-family-mono);
  color: var(--dtm-color-text);
  word-break: break-all;
}

.dtm-validation__code {
  font-family: var(--dtm-font-family-mono);
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
}

.dtm-validation__message {
  color: var(--dtm-color-text-muted);
}

.dtm-validation__reference {
  font-size: var(--dtm-font-size-sm);
  color: var(--dtm-color-text-subtle);
  text-decoration: none;
  white-space: nowrap;
}

.dtm-validation__reference:hover {
  text-decoration: underline;
  color: var(--dtm-color-text);
}
</style>
