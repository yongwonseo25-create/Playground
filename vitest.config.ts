import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@adapter': path.resolve(__dirname, 'packages/adapter/src'),
      '@ssce': path.resolve(__dirname, 'apps/api/src')
    }
  },
  test: {
    environment: 'node'
  }
});
