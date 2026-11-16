// Lint do web (DEV-007): Vue essential + TypeScript recomendado; sem regras de estilo.
import js from '@eslint/js';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default defineConfigWithVueTs(
  { ignores: ['dist/', 'coverage/', 'cypress/screenshots/', 'cypress/videos/', 'cypress/downloads/'] },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    files: ['*.config.ts', '*.config.js', 'cypress/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
);
