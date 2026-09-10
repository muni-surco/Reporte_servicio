import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    target: 'es2018',
    outDir: 'dist/reports-assets',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'report-entry.ts'),
      formats: ['iife'],
      name: 'reportBundle',
      fileName: () => 'reports.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
