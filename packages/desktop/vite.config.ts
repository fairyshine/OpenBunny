import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'zustand', 'react-i18next'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@openbunny/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@openbunny/ui-web/styles': path.resolve(__dirname, '../ui-web/src/index.css'),
      '@openbunny/ui-web': path.resolve(__dirname, '../ui-web/src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
})
