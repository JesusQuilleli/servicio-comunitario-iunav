import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Una sola base de datos compartida: nunca paralelizar archivos.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
