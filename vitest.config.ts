/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  // Allow Bun-specific imports in tests
  optimizeDeps: {
    exclude: ['bun:sqlite']
  },
})
