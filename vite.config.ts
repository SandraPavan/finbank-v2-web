/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Mesma origem em desenvolvimento e no preview; o Host original é preservado. */
const api = { '/api': { target: process.env['API_PROXY_TARGET'] ?? 'http://127.0.0.1:13000', changeOrigin: false } };

export default defineConfig({
  server: { proxy: api },
  preview: { proxy: api },
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/*.spec.ts'],
    globals: false,
    teardownTimeout: 5_000,
  },
});
