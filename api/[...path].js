// Disable Next.js body parsing so we can forward raw bodies (JSON, form-data, binary)
export const config = {
  api: {
    bodyParser: false,
    // optional: increase limit if needed: sizeLimit: '10mb'
  },
};

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  // CORS: echo the Origin (or allow all if none), allow requested headers
  const origin = req.headers.origin || '*';
  const requestHeaders = req.headers['access-control-request-headers'];
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestHeaders || 'Content-Type, Authorization'
  );
  // If you want to forward cookies, set this to true and forward cookies in headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const { path = [] } = req.query;
    const pathname =
      '/' + (Array.isArray(path) ? path.map(String).join('/') : String(path || ''));

    // Base URL and optional API key come from env vars so you don't hardcode secrets
    const base = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE;

    // Preserve query string from original request if present
    const qs = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
    const targetUrl = base.replace(/\/+$/, '') + pathname + (qs ? `?${qs}` : '');

    // Build outgoing headers by copying incoming ones, but drop hop-by-hop and host/content-length
    const hopByHop = new Set([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
      'host',
      'content-length',
    ]);
    const outgoingHeaders = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      const key = k.toLowerCase();
      if (hopByHop.has(key)) continue;
      if (v !== undefined) outgoingHeaders[k] = v;
    }

    // Prefer caller's Authorization header; otherwise fall back to configured API key
    if (!outgoingHeaders.authorization && process.env.OPENROUTER_API_KEY) {
      outgoingHeaders.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    }

    // Read raw body for non-GET/HEAD methods so we can forward exactly what we received
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await readRawBody(req);
      if (body && body.length === 0) body = undefined;
    }

    // Timeout support
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: outgoingHeaders,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Forward status
    res.status(upstream.status);

    // Copy headers except hop-by-hop ones
    upstream.headers.forEach((value, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        // Avoid duplicate CORS headers from upstream
        if (key.toLowerCase() === 'access-control-allow-origin') return;
        res.setHeader(key, value);
      }
    });

    // Buffer response (simple, compatible). For very large responses consider streaming.
    const buffer = Buffer.from(await upstream.arrayBuffer());
    // If upstream provided content-type, it was already copied above; send body
    return res.send(buffer);
  } catch (err) {
    // Distinguish timeout
    if (err && err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Proxy Error', message: err?.message });
  }
}


这个可以么

