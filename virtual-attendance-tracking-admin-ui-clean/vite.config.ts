import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/qr/api': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        // FIX: Added underscores to unused variables
        configure: (proxy, _options ) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.method === 'GET') {
              proxyReq.removeHeader('Content-Type');
            }
          });
        }
      },
      '/qr-admin/qr/api': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (path ) => path.replace(/^\/qr-admin/, ''),
        // FIX: Added underscores to unused variables
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.method === 'GET') {
              proxyReq.removeHeader('Content-Type');
            }
          });
        }
      }
    }
  },
  preview: {
    port: 9091,
    host: true,
    proxy: {
      '/qr/api': 'http://localhost:9090',
      '/qr-admin/qr/api': 'http://localhost:9090'
    }
  },
  base: '/qr-admin/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
} );
