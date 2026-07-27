import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Resolve the workspace package to its TypeScript source so vitest
      // runs against source (not the built dist/, which is gitignored and
      // therefore absent on CI after `npm ci`).
      '@dtcg-mapper/core': fileURLToPath(
        new URL('../packages/core/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
