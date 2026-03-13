import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

export default defineConfig(({ command }) => ({
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
      '@shared': path.resolve(__dirname, command === 'build' ? '../shared/dist' : '../shared/src'),
      '@openbunny/shared': path.resolve(__dirname, command === 'build' ? '../shared/dist' : '../shared/src'),
      '@openbunny/ui-web/styles': path.resolve(__dirname, command === 'build' ? '../ui-web/dist/index.css' : '../ui-web/src/index.css'),
      '@openbunny/ui-web': path.resolve(__dirname, command === 'build' ? '../ui-web/dist' : '../ui-web/src'),
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
}))
