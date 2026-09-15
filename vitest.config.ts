import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/**/*.test.ts', 'apps/content/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'local',
          environment: 'node',
          include: ['apps/web/**/*.test.ts'],
          setupFiles: ['./tests/setup/indexeddb.ts'],
        },
      },
    ],
  },
});
