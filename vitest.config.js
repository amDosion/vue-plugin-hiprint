/**
 * vitest config for V2 + V3 unit tests.
 *
 * V2 (src/hiprint-v2/**) — 474 tests, ported ES module form of bundle.js.
 * V3 (src/hiprint-v3/**) — TypeScript modern rewrite (in progress, see ADR-0011).
 * 不测 src/hiprint/hiprint.bundle.js (用 e2e).
 *
 * P17 (V3 components): registered `@vitejs/plugin-vue` so `.vue` SFCs in
 * `src/hiprint-v3/components/**` can be imported by component tests using
 * `@vue/test-utils` `mount()`.
 */
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      'src/hiprint-v2/**/__tests__/**/*.spec.{js,ts}',
      'src/hiprint-v3/**/__tests__/**/*.spec.{js,ts}',
    ],
    environment: 'happy-dom',
    globals: false,
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@hiprint-v2': path.resolve(__dirname, 'src/hiprint-v2'),
      '@hiprint-v3': path.resolve(__dirname, 'src/hiprint-v3'),
    },
  },
})
