import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) requires manualChunks to be a function.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('i18next')) return 'vendor-i18n';
          if (id.includes('@tanstack') || id.includes('axios') || id.includes('zustand')) return 'vendor-query';
          if (id.includes('react-router') || id.includes('react-dom') || /node_modules[\\/](react|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8096',
        changeOrigin: true
      },
      '/ws': {
        target: 'http://localhost:8096',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'].includes(err.code)) return;
            console.warn('[vite proxy error]:', err.message);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', (err) => {
              if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'].includes(err.code)) return;
            });
          });
        }
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
