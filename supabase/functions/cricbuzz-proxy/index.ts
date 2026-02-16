import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RAPIDAPI_HOST = 'cricbuzz-cricket.p.rapidapi.com';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed Cricbuzz API endpoint prefixes — prevents open relay abuse
const ALLOWED_ENDPOINT_PREFIXES = [
  '/matches/v1/',
  '/mcenter/v1/',
  '/series/v1/',
  '/stats/v1/',
  '/players/v1/',
];

/**
 * Validate that the requested endpoint is safe and allowed.
 * Returns null if valid, or an error string if invalid.
 */
function validateEndpoint(endpoint: string): string | null {
  if (!endpoint.startsWith('/')) {
    return 'Endpoint must start with /';
  }
  if (endpoint.includes('..')) {
    return 'Path traversal not allowed';
  }
  if (endpoint.includes('://')) {
    return 'Absolute URLs not allowed';
  }
  const isAllowed = ALLOWED_ENDPOINT_PREFIXES.some((prefix) =>
    endpoint.startsWith(prefix)
  );
  if (!isAllowed) {
    return `Endpoint not in allowlist. Allowed prefixes: ${ALLOWED_ENDPOINT_PREFIXES.join(', ')}`;
  }
  return null;
}

// Simple in-memory cache with TTL
interface CacheEntry {
  data: unknown;
  timestamp: number;
  status: number;
}

const cache = new Map<string, CacheEntry>();

// Clean expired entries periodically
function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

// Clean cache every minute
setInterval(cleanCache, 60 * 1000);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let endpoint: string | null = null;
    let bypassCache = false;

    // Support both GET with query param and POST with body
    if (req.method === 'GET') {
      const url = new URL(req.url);
      endpoint = url.searchParams.get('endpoint');
      bypassCache = url.searchParams.get('bypass_cache') === 'true';
    } else if (req.method === 'POST') {
      const body = await req.json();
      endpoint = body.endpoint;
      bypassCache = body.bypass_cache === true;
    }

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate endpoint against allowlist
    const endpointError = validateEndpoint(endpoint);
    if (endpointError) {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint', details: endpointError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (unless bypass requested)
    if (!bypassCache) {
      const cached = cache.get(endpoint);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`Cache hit for ${endpoint}`);
        return new Response(
          JSON.stringify(cached.data),
          {
            status: cached.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
              'X-Cache-Age': String(Math.floor((Date.now() - cached.timestamp) / 1000)),
            }
          }
        );
      }
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ error: 'RAPIDAPI_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward request to Cricbuzz API
    const cricbuzzUrl = `https://${RAPIDAPI_HOST}${endpoint}`;

    const response = await fetch(cricbuzzUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    // Handle binary responses (images)
    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.startsWith('image/') || contentType.includes('application/octet-stream'))) {
      const arrayBuffer = await response.arrayBuffer();
      return new Response(arrayBuffer, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // Cache images for 24 hours
        }
      });
    }

    const data = await response.json();

    // Cache successful responses (JSON only)
    if (response.ok) {
      cache.set(endpoint, {
        data,
        timestamp: Date.now(),
        status: response.status,
      });
      console.log(`Cached response for ${endpoint}`);
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
        }
      }
    );
  } catch (error) {
    console.error('Cricbuzz proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
