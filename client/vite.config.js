import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : []
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8096',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'http://localhost:8096',
        changeOrigin: true,
        ws: true
      },
      '/stream': {
        target: 'http://localhost:8096',
        changeOrigin: true
      },
      '/dlna': {
        target: 'http://localhost:8096',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173
  }
});
