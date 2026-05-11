/**
 * vitest config for V2 unit tests (P2+)
 *
 * 仅测 src/hiprint-v2/ 内的 ES module. 不测 src/hiprint/hiprint.bundle.js (用 e2e).
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/hiprint-v2/**/__tests__/**/*.spec.{js,ts}'],
    environment: 'happy-dom',
    globals: false,
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@hiprint-v2': path.resolve(__dirname, 'src/hiprint-v2'),
    },
  },
})
