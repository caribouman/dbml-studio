import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      usePolling: true, // Needed for Docker on some systems
    },
    hmr: {
      overlay: true,
      clientPort: 443,
      host: 'dbml-studio.soyecourt.ovh',
      protocol: 'wss',
    },
  },
  optimizeDeps: {
    include: ['html-to-image'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'reactflow': ['reactflow'],
          'codemirror': ['@codemirror/lang-sql', '@codemirror/state', '@codemirror/view', '@codemirror/theme-one-dark', '@uiw/react-codemirror'],
          'dbml': ['@dbml/core'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
