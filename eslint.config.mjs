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
  {
    /**
     * A route body runs top to bottom the moment the request arrives, so a
     * `const` read above its own declaration is never a late call — it is a
     * ReferenceError on every render, and one that neither `tsc` nor the build
     * reports when the read sits inside a callback that runs immediately
     * (`Array.from`, `.map`, an IIFE). The dashboard shipped exactly that and
     * showed every student the error page.
     *
     * Scoped to route files on purpose: elsewhere a module constant declared
     * below the function that uses it is fine, because that function is called
     * after the module has finished evaluating.
     */
    files: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/route.ts'],
    rules: {
      'no-use-before-define': [
        'error',
        { variables: true, functions: false, classes: false, allowNamedExports: true },
      ],
    },
  },
];

export default config;
