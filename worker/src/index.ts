/**
 * Cloudflare Worker CORS Proxy for CyberBunny
 *
 * Routes browser requests to external APIs (OpenAI, Anthropic, vLLM, DuckDuckGo)
 * while handling CORS and streaming SSE responses.
 */

interface Env {
  ALLOWED_ORIGINS: string;
}

/** Headers that should NOT be forwarded to the target API */
const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  // Our custom header — consumed by the proxy, not forwarded
  'x-target-url',
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Parse allowed origins from environment
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

    // Validate origin
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed === origin) return true;
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain);
      }
      return false;
    });

    // CORS headers helper
    const corsHeaders = (extra?: Record<string, string>) => ({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      ...extra,
    });

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin) {
        return new Response('Forbidden', { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(),
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Handle proxy requests — accept any method
    if (url.pathname === '/proxy') {
      if (!isAllowedOrigin) {
        return new Response('Forbidden: Origin not allowed', { status: 403, headers: corsHeaders() });
      }

      const targetUrl = request.headers.get('X-Target-URL');
      if (!targetUrl) {
        return new Response('Bad Request: Missing X-Target-URL header', { status: 400, headers: corsHeaders() });
      }

      try {
        const target = new URL(targetUrl);
        if (target.protocol !== 'https:' && target.protocol !== 'http:') {
          return new Response('Bad Request: Invalid target URL protocol', { status: 400, headers: corsHeaders() });
        }

        // Forward all headers except hop-by-hop ones
        const targetHeaders = new Headers();
        for (const [key, value] of request.headers.entries()) {
          if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            targetHeaders.set(key, value);
          }
        }
        // Set correct Host for the target
        targetHeaders.set('Host', target.host);

        const targetResponse = await fetch(targetUrl, {
          method: request.method,
          headers: targetHeaders,
          body: request.body,
        });

        // Stream response back with CORS headers
        const responseHeaders = new Headers(targetResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', origin);
        responseHeaders.set('Access-Control-Allow-Credentials', 'true');

        return new Response(targetResponse.body, {
          status: targetResponse.status,
          statusText: targetResponse.statusText,
          headers: responseHeaders,
        });

      } catch (error) {
        console.error('Proxy error:', error);
        return new Response(
          JSON.stringify({
            error: 'Proxy request failed',
            message: error instanceof Error ? error.message : String(error)
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          }
        );
      }
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'cyberbunny-proxy' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
