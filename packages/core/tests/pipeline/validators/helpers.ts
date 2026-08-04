/**
 * Test helper for validator unit tests.
 *
 * Each per-type validator is a `(value, ctx) => void` that calls `ctx.report`
 * for each violation. Tests pass a collecting `FieldCtx` built here and
 * assert on the captured reports — no token map, no parsing, just the
 * validator under test in isolation.
 */
import type { FieldCtx } from '@/pipeline/validators/types'
import type { ValidationCode } from '@/types/validation'

/** One captured `report` call. */
export interface Report {
  path: string
  code: ValidationCode
  message: string
}

/**
 * Build a `FieldCtx` whose `report` pushes into a returned array, so a test
 * can assert on which (if any) violations the validator emitted.
 *
 * @example
 *   const { reports, ctx } = makeCtx('color.red')
 *   validateColor(42, ctx)
 *   expect(reports).toHaveLength(1)
 *   expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
 */
export function makeCtx(path = 'token'): {
  reports: Report[]
  ctx: FieldCtx
} {
  const reports: Report[] = []
  // `report` reads `details.path` (passed by each validator as `ctx.path`),
  // so child contexts built via `childCtx(parent, field)` — which share this
  // `report` reference but pass their own path — record *their* path on each
  // captured report.
  const ctx: FieldCtx = {
    path,
    report: ({ path: reportPath, code, message }) => {
      reports.push({ path: reportPath, code, message })
    },
  }
  return { reports, ctx }
}
