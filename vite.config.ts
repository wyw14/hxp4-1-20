import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  server: {
    port: 41020,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:42020',
        changeOrigin: true
      }
    }
  }
});
