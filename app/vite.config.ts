import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves the site at /<repo-name>/. Override locally with BASE_PATH
// (e.g. `BASE_PATH=/ npm run dev`) when you want root-relative URLs.
const BASE_PATH = process.env.BASE_PATH ?? '/token-mapper/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Resolve the workspace package to its TypeScript source so Vite
      // (dev server + production build) runs against source — not the
      // built dist/, which is gitignored and absent on CI after `npm ci`.
      '@dtcg-mapper/core': fileURLToPath(
        new URL('../packages/core/src/index.ts', import.meta.url)
      ),
    },
  },
})
