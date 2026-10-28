import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // Les migracions les escriu `migrate:create`: el `down` deixa arguments
    // sense fer servir i no és codi que es toqui a mà.
    files: ['packages/core/src/migrations/**'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    ignores: [
      '**/dist/',
      '**/.build/',
      '**/.next/',
      'examples/demo/src/app/(subur)/admin/importMap.js',
      'packages/core/src/types/subur-types.ts',
      '**/.tmp-app-*/',
    ],
  },
]

export default eslintConfig
