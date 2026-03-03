import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // GitHub Pages 部署配置 - 根据仓库名自动调整
  base: process.env.GITHUB_PAGES ? '/CyberBunny/' : '/',
  server: {
    // 配置代理以解决 CORS 问题
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        configure: (proxy, options) => {
          // 动态代理配置 - 支持自定义目标
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const target = url.searchParams.get('target');

            if (target) {
              // 使用自定义目标
              const targetUrl = new URL(decodeURIComponent(target));
              console.log(`[Proxy] Forwarding to custom target: ${targetUrl.origin}`);

              // 修改请求头
              proxyReq.setHeader('host', targetUrl.host);
              proxyReq.path = targetUrl.pathname + targetUrl.search;
              options.target = targetUrl.origin;
            } else {
              console.log(`[Proxy] Forwarding to default: ${options.target}`);
            }
          });
        }
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React 核心库 (包含 scheduler)
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }

          // Radix UI 组件
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }

          // UI 工具库
          if (id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge')) {
            return 'vendor-ui';
          }

          // 状态管理
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }

          // i18n 国际化
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }

          // Pyodide (Python 运行时)
          if (id.includes('node_modules/pyodide')) {
            return 'vendor-pyodide';
          }

          // 日历组件
          if (id.includes('node_modules/react-day-picker')) {
            return 'vendor-calendar';
          }

          // 其他 node_modules (排除已分类的)
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
