import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite plugin that acts as a CORS proxy for AI API calls in dev mode.
 * Handles `/api/proxy?target=<encoded-url>` by making a fresh HTTPS/HTTP
 * connection to the target, forwarding the request body and headers.
 */
function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res, next) => {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': '*',
            'access-control-allow-headers': '*',
            'access-control-max-age': '86400',
          });
          res.end();
          return;
        }

        try {
          const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
          const target = reqUrl.searchParams.get('target');

          if (!target) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing ?target= parameter');
            return;
          }

          const targetUrl = new URL(decodeURIComponent(target));
          console.log(`[CORS Proxy] ${req.method} → ${targetUrl.href}`);
          const acceptHeader = String(req.headers.accept || '').toLowerCase();
          const isSseRequest = req.method === 'GET' && acceptHeader.includes('text/event-stream');

          // Collect request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const body = Buffer.concat(chunks);

          // Forward headers, replacing host and removing hop-by-hop headers
          const forwardHeaders: Record<string, string> = {};
          const skipHeaders = new Set([
            'host', 'connection', 'keep-alive', 'transfer-encoding',
            'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate',
          ]);
          for (const [key, value] of Object.entries(req.headers)) {
            if (!skipHeaders.has(key.toLowerCase()) && value) {
              forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          }
          forwardHeaders['host'] = targetUrl.host;

          // Make the actual request to the target
          const fetchRes = await fetch(targetUrl.href, {
            method: req.method || 'POST',
            headers: forwardHeaders,
            body: body.length > 0 ? body : undefined,
            // @ts-ignore - Node.js fetch duplex option
            duplex: 'half',
          });

          if (isSseRequest && [400, 404, 405].includes(fetchRes.status)) {
            res.writeHead(200, {
              'access-control-allow-origin': '*',
              'access-control-allow-methods': '*',
              'access-control-allow-headers': '*',
              'cache-control': 'no-cache, no-transform',
              'content-type': 'text/event-stream; charset=utf-8',
            });
            if (typeof res.flushHeaders === 'function') {
              res.flushHeaders();
            }
            res.write(': upstream MCP server does not support inbound SSE\n\n');
            res.end();
            return;
          }

          // Forward response status and headers with CORS headers
          const responseHeaders: Record<string, string> = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': '*',
            'access-control-allow-headers': '*',
          };
          fetchRes.headers.forEach((value, key) => {
            const lower = key.toLowerCase();
            // Skip hop-by-hop headers and content-encoding (Node fetch auto-decompresses)
            if (lower !== 'transfer-encoding' && lower !== 'connection' && lower !== 'content-encoding' && lower !== 'content-length') {
              responseHeaders[key] = value;
            }
          });

          res.writeHead(fetchRes.status, responseHeaders);

          const isSseResponse = (responseHeaders['content-type'] || responseHeaders['Content-Type'] || '')
            .toLowerCase()
            .includes('text/event-stream');
          if (isSseResponse && typeof res.flushHeaders === 'function') {
            res.flushHeaders();
          }

          if (fetchRes.body) {
            // Stream the response body
            const reader = fetchRes.body.getReader();
            const chunks: Uint8Array[] = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
              res.write(value);
            }
            // Debug: log response body for DeepSeek
            if (targetUrl.href.includes('deepseek')) {
              const responseText = Buffer.concat(chunks).toString('utf-8');
              console.log('[CORS Proxy] DeepSeek response:', responseText.substring(0, 500));
            }
          }
          res.end();
        } catch (error) {
          console.error('[CORS Proxy] Error:', error);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
          }
          res.end(`Proxy error: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), corsProxyPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom', 'zustand', 'react-i18next'],
    alias: {
      '@shared': path.resolve(__dirname, command === 'build' ? '../shared/dist' : '../shared/src'),
      '@openbunny/shared': path.resolve(__dirname, command === 'build' ? '../shared/dist' : '../shared/src'),
      '@openbunny/ui-web/styles': path.resolve(__dirname, command === 'build' ? '../ui-web/dist/index.css' : '../ui-web/src/index.css'),
      '@openbunny/ui-web': path.resolve(__dirname, command === 'build' ? '../ui-web/dist' : '../ui-web/src'),
    },
  },
  // GitHub Pages 部署配置 - 根据仓库名自动调整
  base: process.env.GITHUB_PAGES ? '/OpenBunny/' : '/',
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
