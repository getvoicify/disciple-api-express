import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/tests/**/repositories/**/*.test.ts',
      'src/tests/**/migrations/**/*.test.ts',
      'src/tests/**/moderation.service.test.ts',
      'src/tests/**/prayer-attachment.test.ts',
      'src/tests/**/threading-optimization.test.ts',
      'src/tests/integration/**/*.test.ts',
    ],
    testTimeout: 60000,
  },
});
