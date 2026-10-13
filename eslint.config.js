import javascript from '@eslint/js';
import typescript from 'typescript-eslint';
import globals from 'globals';

export default typescript.config(
  {
    ignores: ['dist/**', 'coverage/**', '.claude/**', '.agent-lock/**'],
  },
  javascript.configs.recommended,
  ...typescript.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
