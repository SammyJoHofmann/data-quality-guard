// ============================================================
// FILE: vitest.config.ts
// PATH: vitest.config.ts
// PROJECT: DataQualityGuard
// PURPOSE: Vitest test runner configuration
// ============================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
    },
  },
});
