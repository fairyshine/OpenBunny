/**
 * Cloudflare Worker CORS Proxy for CyberBunny
 *
 * Routes browser requests to external APIs (OpenAI, Anthropic, vLLM, DuckDuckGo)
 * while handling CORS and streaming SSE responses.
 */

interface Env {
  ALLOWED_ORIGINS: string;
}

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
      // Support wildcard subdomains like *.github.io
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain);
      }
      return false;
    });

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin) {
        return new Response('Forbidden', { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Target-URL, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Handle proxy requests
    if (request.method === 'POST' && url.pathname === '/proxy') {
      if (!isAllowedOrigin) {
        return new Response('Forbidden: Origin not allowed', { status: 403 });
      }

      const targetUrl = request.headers.get('X-Target-URL');
      if (!targetUrl) {
        return new Response('Bad Request: Missing X-Target-URL header', { status: 400 });
      }

      try {
        // Validate target URL
        const target = new URL(targetUrl);
        if (target.protocol !== 'https:' && target.protocol !== 'http:') {
          return new Response('Bad Request: Invalid target URL protocol', { status: 400 });
        }

        // Forward request to target API
        const targetHeaders = new Headers();

        // Forward essential headers
        const headersToForward = ['Content-Type', 'Authorization', 'Accept', 'User-Agent'];
        for (const header of headersToForward) {
          const value = request.headers.get(header);
          if (value) {
            targetHeaders.set(header, value);
          }
        }

        // Make request to target API
        const targetResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: targetHeaders,
          body: request.body,
        });

        // Create response with CORS headers
        const responseHeaders = new Headers(targetResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', origin);
        responseHeaders.set('Access-Control-Allow-Credentials', 'true');

        // Stream response back to client (zero-copy for SSE)
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
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
            }
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
