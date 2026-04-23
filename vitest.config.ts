import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    globals: true,
    css: false,
    // Vitest runs our RTL/fixture tests in __tests__. Playwright specs under
    // tests/ have their own runner (npx playwright test) and must not be
    // loaded here — doing so trips Playwright's "did not expect
    // test.describe() to be called here" guard.
    include: ['__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['node_modules/**', '.next/**', 'tests/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
