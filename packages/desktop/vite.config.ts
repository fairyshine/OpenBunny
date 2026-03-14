import { defineConfig, type AliasOptions } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { createOpenBunnyManualChunks } from '../../scripts/vite-chunks.mjs'

function createWorkspaceAliases(command: 'build' | 'serve'): AliasOptions {
  if (command === 'build') {
    return {}
  }

  return {
    '@shared': path.resolve(__dirname, '../shared/src'),
    '@openbunny/shared': path.resolve(__dirname, '../shared/src'),
    '@openbunny/ui-web/styles': path.resolve(__dirname, '../ui-web/src/index.css'),
    '@openbunny/ui-web': path.resolve(__dirname, '../ui-web/src'),
  }
}

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
    alias: createWorkspaceAliases(command),
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: createOpenBunnyManualChunks,
      },
    },
  },
}))
