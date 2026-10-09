import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // I test end-to-end girano con Playwright, non con Vitest.
    include: ['pipeline/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: { include: ['pipeline/**/*.ts', 'src/lib/**/*.ts'], exclude: ['**/*.test.ts', '**/*.svelte.ts', 'pipeline/run.ts'] },
  },
});
