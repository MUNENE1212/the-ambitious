import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Financial logic is pure and deterministic; every expected value is
    // written out literally rather than computed, so a test can never pass by
    // re-implementing the bug it is meant to catch.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
});