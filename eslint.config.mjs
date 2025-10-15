// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Recommended ESLint config
  eslint.configs.recommended,

  // Recommended TypeScript ESLint configs
  ...tseslint.configs.recommended,

  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'scripts/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      'vitest.config.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],
  },

  // Custom rules
  {
    rules: {
      // Disable rules that conflict with TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Allow explicit any in some cases
      '@typescript-eslint/no-explicit-any': 'warn',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
    },
  },
]);
