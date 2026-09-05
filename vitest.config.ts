import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // AllSport is an NZ-only app and its dates mean NZ wall-clock time, so the
    // suite runs in NZ time rather than the runner's. Without this, the cases in
    // __tests__/dates.test.ts that build a Date from device-local parts pass on
    // a Christchurch laptop and fail in a UTC container. The load-bearing
    // assertions there (toNZDateString, and sessionStart's date-matches-timestamp
    // invariant) are deliberately written to hold WITHOUT this pin — verified by
    // running them under TZ=UTC with the pin removed.
    env: { TZ: 'Pacific/Auckland' },
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
