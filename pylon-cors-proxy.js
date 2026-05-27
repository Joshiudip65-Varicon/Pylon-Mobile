/**
 * Pylon CORS proxy — Cloudflare Worker
 * ------------------------------------
 * Why: browsers block direct fetches to api.usepylon.com because Pylon's API
 * doesn't send CORS headers (API keys aren't meant to be in browser code).
 * This tiny Worker sits in front of the Pylon API, forwards your request,
 * and adds the CORS headers the browser needs.
 *
 * Deploy (free tier is plenty):
 *   1. Sign up at https://dash.cloudflare.com (free).
 *   2. Workers & Pages → Create → Create Worker → name it e.g. "pylon-proxy".
 *   3. "Edit code", paste this whole file, click Deploy.
 *   4. Copy the worker URL (e.g. https://pylon-proxy.<you>.workers.dev).
 *   5. In Pylon Mobile, open Settings → CORS proxy and paste that URL.
 *
 * SECURITY:
 *   - Restrict ALLOWED_ORIGINS below to only the domain(s) where you host
 *     pylon-mobile.html. Anyone who knows your Worker URL AND has a valid
 *     Pylon key can use it — but the key itself never leaves your browser
 *     except in the request you make.
 *   - For personal use on a single device, "*" is acceptable. For team use,
 *     lock it down.
 */

const PYLON_BASE = 'https://api.usepylon.com';

// Lock this down to the origin(s) where you host the HTML file.
// Examples:
//   const ALLOWED_ORIGINS = ['https://yourname.github.io'];
//   const ALLOWED_ORIGINS = ['http://localhost:8080', 'https://pylon.example.com'];
// For personal use, "*" is fine.
const ALLOWED_ORIGINS = ['*'];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Forward path + query verbatim to Pylon
    const url = new URL(request.url);
    const upstream = PYLON_BASE + url.pathname + url.search;

    // Pass through everything except hop-by-hop headers
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'origin', 'referer'].includes(lk)) continue;
      fwdHeaders.set(k, v);
    }

    const init = {
      method: request.method,
      headers: fwdHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    };

    let upstreamResp;
    try {
      upstreamResp = await fetch(upstream, init);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Upstream fetch failed: ' + (e.message || e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Re-wrap response with CORS headers
    const respHeaders = new Headers(upstreamResp.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) respHeaders.set(k, v);
    // Strip content-encoding because Cloudflare may decode the body
    respHeaders.delete('content-encoding');
    respHeaders.delete('content-length');

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  },
};
