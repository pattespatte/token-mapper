/**
 * @dtcg-mapper/core — pure DTCG design-token pipeline.
 *
 * Public API. Everything the app and CLI consume is re-exported here. Internal
 * modules use relative imports (no Vite `@/` alias — this package builds via
 * `tsup`, not Vite).
 *
 * Purity contract: zero Vue imports, zero browser-only APIs. The only browser
 * touch-point is `CSS.supports` inside `isValidColor`, which has a regex
 * fallback for Node environments (used by the CLI).
 */

// Pipeline
export { parseFiles, type InputFile, type ParseResult } from './pipeline/parse'
export { validate } from './pipeline/validate'
export { resolve } from './pipeline/resolve'
export { diff } from './pipeline/diff'
export { explainDiff } from './pipeline/explainDiff'
export {
  toMarkdownDiffReport,
  toJsonDiffReport,
  type ReportMeta,
} from './pipeline/exportDiff'

// Ingest
export { parseCss } from './ingest/cssCustomProperties'

// Utils
export {
  isValidColor,
  isValidDimension,
  inferType,
} from './utils/cssTypeInference'
export {
  isStructuredColor,
  parseHex,
  normalizeToHex,
  rgbToHsl,
  rgbDistance,
} from './utils/color'
export { joinPath, parseReference } from './utils/path'

// Types
export type { DtcgType } from './types/dtcg'
export type {
  RawValue,
  NormalizedToken,
  AliasHop,
  ResolvedToken,
  TokenMap,
  ResolvedTokenMap,
  TokenSet,
} from './types/token'
export type {
  DiffBucket,
  DiffResult,
  TokenDiff,
  DiffExplanation,
} from './types/diff'
export type { ValidationIssue, ValidationCode, Severity } from './types/validation'
