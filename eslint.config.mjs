import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * Flat config. `next lint` is deprecated and prompts interactively, which
 * would hang CI, so the lint script calls the ESLint CLI directly.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.test-build/**',
      'next-env.d.ts',
      'supabase/**',
      'scripts/**',
    ],
  },
  ...(Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals]),
  ...(Array.isArray(typescript) ? typescript : [typescript]),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
