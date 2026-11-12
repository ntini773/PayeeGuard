import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:8765';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        headers: {
          Origin: backend,
        },
      },
      '/callback': {
        target: backend,
        changeOrigin: true,
        headers: {
          Origin: backend,
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mermaid')) {
            return 'mermaid';
          }
          if (id.includes('node_modules/shiki') || id.includes('node_modules/@shikijs')) {
            return 'shiki';
          }
          if (id.includes('node_modules/@xyflow')) {
            return 'flow';
          }
          if (id.includes('node_modules/ag-grid-community') || id.includes('node_modules/ag-grid-react')) {
            return 'ag-grid';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
