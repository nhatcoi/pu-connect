import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// ESLint flat config: NestJS + TypeScript (luật khuyến nghị, không cần type-check để chạy nhanh)
export default tseslint.config({ ignores: ['dist/**', 'node_modules/**'] }, js.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: { globals: { ...globals.node, ...globals.jest } },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // hàng SQL (pg) trả any
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
  }
})
