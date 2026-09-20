import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'data/**',
    'public/**',
    'node_modules/**',
    'test-results/**',
    'playwright-report/**',
    'performance-report/**',
  ]),
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
]);
