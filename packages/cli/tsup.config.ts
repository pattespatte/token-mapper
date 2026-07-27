import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // Bundle @dtcg-mapper/core into the CLI output so the published CLI
  // has no workspace dependency at runtime.
  noExternal: ['@dtcg-mapper/core'],
})
