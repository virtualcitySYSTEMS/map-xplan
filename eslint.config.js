import { configs, createNamingConventionOptions } from '@vcsuite/eslint-config';

export default [
  ...configs.vueTs,
  {
    ignores: ['node_modules/', 'dist/'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...createNamingConventionOptions(),
        {
          selector: ['typeLike'],
          format: ['PascalCase', 'snake_case'],
        },
      ],
    },
  },
];
