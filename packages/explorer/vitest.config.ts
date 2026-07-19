import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/test-utils/fake-idb-setup.ts'],
      passWithNoTests: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/domain/**/*.ts', 'src/data/**/*.ts', 'src/state/**/*.ts'],
        exclude: ['**/*.test.ts', '**/types.ts'],
        thresholds: {
          // Brief: ≥60% by Phase 1, ≥80% by Phase 2. Start permissive; tighten as code lands.
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
      },
    },
  }),
);
