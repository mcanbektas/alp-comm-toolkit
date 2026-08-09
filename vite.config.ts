import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Comm SPA süit içinde /comm altından servis edilir (Faz 4'te nginx path routing).
// Geliştirmede kendi portunda koşar: PCB 3000'i tuttuğu için Comm 3001.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      // Platform API'si alp-platform deposunda 5289'da koşar.
      '/api': {
        target: 'http://localhost:5289',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
