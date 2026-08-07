import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Node by default (pure-logic tests are the bulk and stay fast); component
    // tests opt into jsdom with a `@vitest-environment jsdom` docblock.
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['.claude/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
