import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: [
      'node_modules/**',
      'dist/**',
      '.claude/**',
      'src/tests/**/repositories/**',
      'src/tests/**/migrations/**',
      'src/tests/**/moderation.service.test.ts',
      'src/tests/**/prayer-attachment.test.ts',
      'src/tests/**/threading-optimization.test.ts',
      'src/tests/integration/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
    },
  },
});