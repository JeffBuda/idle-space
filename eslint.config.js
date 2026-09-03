import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';

import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'dev-dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      sourceType: 'module',
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries: boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/elements': [
        { type: 'engine', pattern: 'src/engine/**' },
        { type: 'db', pattern: 'src/db/**' },
        { type: 'utils', pattern: 'src/utils/**' },
        { type: 'hooks', pattern: 'src/hooks/**' },
        { type: 'components', pattern: 'src/components/**' },
      ],
      'boundaries/files': [{ category: 'test', pattern: 'src/**/*.test.{ts,tsx}' }],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // ---- Architectural boundary enforcement ----
      'boundaries/dependencies': [
        2,
        {
          default: 'allow',
          policies: [
            // Engine: pure layer — must not depend on db, hooks, components
            {
              from: { element: { type: 'engine' } },
              disallow: {
                to: {
                  element: { types: ['db', 'hooks', 'components'] },
                },
              },
            },
            // Db: persistence layer — must not depend on any other internal layer
            {
              from: { element: { type: 'db' } },
              disallow: {
                to: {
                  element: {
                    types: ['engine', 'hooks', 'components', 'utils'],
                  },
                },
              },
            },
            // Components: presentation layer — must not import engine or db directly
            // Test files (category: 'test') are exempt from boundary checks
            {
              from: { element: { type: 'components' }, file: { categories: '!test' } },
              disallow: {
                to: { element: { types: ['engine', 'db'] } },
              },
            },
            // Hooks: must not depend on components
            {
              from: { element: { type: 'hooks' } },
              disallow: {
                to: {
                  element: { types: ['components'] },
                },
              },
            },
            // Utils: pure utilities — must not depend on any other internal layer
            {
              from: { element: { type: 'utils' } },
              disallow: {
                to: {
                  element: {
                    types: ['engine', 'db', 'hooks', 'components'],
                  },
                },
              },
            },
            // No file (source or test) should import from test files
            {
              disallow: {
                to: { file: { categories: 'test' } },
              },
            },
          ],
        },
      ],
    },
  },
  // ---- Code-level restrictions for the engine layer ----
  // .clinerules/engine.md: No DOM Access, Deterministic Execution,
  // Storage: Always route persistence through the IndexedDB wrapper
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Engine must not use localStorage — use IndexedDB via db layer',
        },
        {
          name: 'sessionStorage',
          message: 'Engine must not use sessionStorage — use IndexedDB via db layer',
        },
        {
          name: 'window',
          message: 'Engine must not access window — the engine layer must be pure',
        },
        {
          name: 'document',
          message: 'Engine must not access document — the engine layer must be pure',
        },
        {
          name: 'Date',
          message: 'Engine must not use Date — pass currentTime as a parameter for determinism',
        },
      ],
    },
  },
  // ---- Code-level restrictions for the db layer ----
  // .clinerules/engine.md: Storage must always route through IndexedDB
  {
    files: ['src/db/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'DB layer must not use localStorage — use IndexedDB only',
        },
        {
          name: 'sessionStorage',
          message: 'DB layer must not use sessionStorage — use IndexedDB only',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
