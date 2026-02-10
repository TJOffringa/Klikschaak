import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.dev.html'),
    },
  },
  server: {
    port: 3000,
    open: '/index.dev.html',
  },
  worker: {
    format: 'es',
  },
});
