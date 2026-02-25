import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // 前端源码 (browser 环境)
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // 代码质量
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-await-in-loop': 'warn',
      'no-return-await': 'warn',
      'no-template-curly-in-string': 'warn',
      'no-self-compare': 'error',
      'no-duplicate-imports': 'error',

      // 环境控制
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': 'error',

      // 安全规则 (LINT-NEW-001)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // React Hooks
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // 后端 + API 路由 (Node.js 环境)
  {
    files: ['backend/**/*.js', 'api/**/*.js', 'supabase/**/*.js'],
    extends: [
      js.configs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-await-in-loop': 'off', // 后端批量操作常需循环 await
      'no-return-await': 'warn',
      'no-self-compare': 'error',
      'no-duplicate-imports': 'error',

      'no-console': 'off', // 后端允许 console
      'no-debugger': 'error',

      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },

  // 配置文件 (vite.config.js, eslint.config.js 等)
  {
    files: ['*.config.js', '*.config.mjs'],
    extends: [
      js.configs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
])
