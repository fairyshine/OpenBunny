import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig, type AliasOptions, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { createOpenBunnyManualChunks } from '../../scripts/vite-chunks.mjs'

function readPackageDependencies(packageDir: string): string[] {
  const packageJson = JSON.parse(
    readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> }

  return Object.keys(packageJson.dependencies ?? {})
}

function createWorkspaceDependencyResolvers(): Array<{ packageRequire: NodeRequire; dependencies: string[] }> {
  const packageDirs = [
    path.resolve(__dirname, '../shared'),
    path.resolve(__dirname, '../ui-web'),
  ]

  return packageDirs.map((packageDir) => ({
    packageRequire: createRequire(path.join(packageDir, 'package.json')),
    dependencies: readPackageDependencies(packageDir),
  }))
}

function createWorkspaceAliases(command: 'build' | 'serve'): AliasOptions {
  if (command === 'build') {
    return []
  }

  return [
    { find: '@shared', replacement: path.resolve(__dirname, '../shared/src') },
    { find: '@openbunny/shared', replacement: path.resolve(__dirname, '../shared/src') },
    { find: '@openbunny/ui-web/styles', replacement: path.resolve(__dirname, '../ui-web/src/index.css') },
    { find: '@openbunny/ui-web', replacement: path.resolve(__dirname, '../ui-web/src') },
  ]
}

function workspacePackageDependencyResolver(): Plugin {
  const resolvers = createWorkspaceDependencyResolvers()

  return {
    name: 'workspace-package-dependency-resolver',
    async resolveId(source) {
      if (
        source.startsWith('.') ||
        source.startsWith('/') ||
        source.startsWith('\0') ||
        /^[a-z]+:/i.test(source)
      ) {
        return null
      }

      for (const resolver of resolvers) {
        const dependencyName = resolver.dependencies.find((dependency) =>
          source === dependency || source.startsWith(`${dependency}/`),
        )

        if (!dependencyName) {
          continue
        }

        try {
          return await this.resolve(resolver.packageRequire.resolve(source), undefined, { skipSelf: true })
        } catch {
          continue
        }
      }

      return null
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [
    workspacePackageDependencyResolver(),
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
