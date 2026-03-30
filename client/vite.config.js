import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backendTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:3005';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3006,
    strictPort: true,
    proxy: {
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'axios', 'idb', 'dexie'],
          utils: ['src/services/api.js'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios'],
  },
});

