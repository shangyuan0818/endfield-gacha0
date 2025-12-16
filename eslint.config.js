import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
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
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // 生产环境禁用console,开发环境仅警告
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': 'error',

      // 安全规则增强 (LINT-NEW-001)
      'no-eval': 'error',                    // 禁止使用 eval()
      'no-implied-eval': 'error',            // 禁止隐式 eval (setTimeout/setInterval 字符串参数)
      'no-new-func': 'error',                // 禁止使用 new Function()

      // React Hooks 规则
      'react-hooks/exhaustive-deps': 'warn', // 检查 useEffect 依赖项
    },
  },
])
