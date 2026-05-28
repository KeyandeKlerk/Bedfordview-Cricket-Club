import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
      ['**/*.test.ts', 'node'],
    ],
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.claude/**', '.claire/**'],
  },
})
