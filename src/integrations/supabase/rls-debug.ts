/**
 * RLS Debug Fetch Wrapper
 *
 * Intercepts PostgREST responses to surface RLS/permission issues
 * in the browser console during local development.
 *
 * Only active when import.meta.env.DEV is true — tree-shaken in production.
 */

declare global {
  interface Window {
    __RLS_DEBUG: boolean;
  }
}

// PostgreSQL / PostgREST error codes related to permissions
const RLS_ERROR_CODES: Record<string, string> = {
  '42501': 'Row-level security policy violation',
  '42000': 'Syntax error or access rule violation',
  '28000': 'Invalid authorization specification',
  '28P01': 'Invalid password',
  'PGRST301': 'JWT expired or invalid',
  'PGRST302': 'JWT missing required claim',
  'PGRST000': 'Could not connect (check anon key / service role)',
};

// Tables where empty SELECT results are expected and should not trigger warnings
const EMPTY_RESULT_SUPPRESSED_TABLES = new Set([
  'draft_state',
  'scoring_rules',
  'draft_picks',
  'draft_order',
  'league_player_pool',
  'trade_players',
  'trades',
  'manager_roster',
  'league_matchups',
  'transactions',
  'league_players',
  'managers',
  'profiles',
  'master_players',
  'cricket_matches',
  'league_matches',
  'league_cricket_matches',
]);

function isPostgRESTRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith('/rest/v1/');
  } catch {
    return false;
  }
}

function extractTableFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/rest\/v1\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

type Operation = 'select' | 'insert' | 'update' | 'delete' | 'rpc';

function getOperation(method: string, url: string): Operation {
  const upper = method.toUpperCase();
  if (upper === 'GET' || upper === 'HEAD') return 'select';
  if (upper === 'POST') {
    return url.includes('/rest/v1/rpc/') ? 'rpc' : 'insert';
  }
  if (upper === 'PATCH') return 'update';
  if (upper === 'DELETE') return 'delete';
  return 'select';
}

interface RLSSignal {
  level: 'warn' | 'error';
  table: string | null;
  operation: Operation;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function logRLSSignal(signal: RLSSignal): void {
  const icon = signal.level === 'error' ? '🔴' : '🟡';
  const tag = signal.level === 'error' ? 'RLS ERROR' : 'RLS WARNING';
  const tableName = signal.table ?? 'unknown';

  const header = `${icon} [${tag}] ${signal.message}`;
  const log = signal.level === 'error' ? console.error : console.warn;

  console.groupCollapsed(header);
  log(`  Table: ${tableName}`);
  log(`  Operation: ${signal.operation}`);
  if (signal.code) log(`  Code: ${signal.code}`);
  if (signal.details) log(`  Details: ${signal.details}`);
  if (signal.hint) log(`  Hint: ${signal.hint}`);
  log(`  Tip: Check RLS policies for "${tableName}" in supabase/migrations/`);
  console.trace('  Call stack');
  console.groupEnd();
}

async function inspectResponse(
  url: string,
  method: string,
  response: Response,
): Promise<void> {
  const table = extractTableFromUrl(url);
  const operation = getOperation(method, url);

  // HTTP-level auth / permission errors
  if (response.status === 401 || response.status === 403) {
    logRLSSignal({
      level: 'error',
      table,
      operation,
      message: `HTTP ${response.status} — ${response.status === 401 ? 'Unauthorized (missing or invalid auth token)' : 'Forbidden'}`,
    });
    return;
  }

  // Only inspect JSON bodies from PostgREST error responses or successful GETs
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return;

  const body = await response.clone().json();

  // PostgREST error body: { code, message, details, hint }
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    const code = String(body.code);
    const knownLabel = RLS_ERROR_CODES[code];
    if (knownLabel) {
      logRLSSignal({
        level: 'error',
        table,
        operation,
        message: `${knownLabel}: ${body.message}`,
        code,
        details: body.details ?? undefined,
        hint: body.hint ?? undefined,
      });
      return;
    }
  }

  // Silent RLS block detection: SELECT returns empty array
  if (
    operation === 'select' &&
    Array.isArray(body) &&
    body.length === 0 &&
    table &&
    !EMPTY_RESULT_SUPPRESSED_TABLES.has(table)
  ) {
    logRLSSignal({
      level: 'warn',
      table,
      operation,
      message: `Empty result from ${table} — possible silent RLS block`,
    });
  }
}

/**
 * Creates a fetch wrapper that inspects PostgREST responses for RLS signals.
 * Safe to use as `global.fetch` in Supabase createClient options.
 */
export function createRLSDebugFetch(): typeof fetch {
  // Enable by default; users can silence via console: window.__RLS_DEBUG = false
  if (typeof window !== 'undefined' && window.__RLS_DEBUG === undefined) {
    window.__RLS_DEBUG = true;
  }

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    const method = init?.method ?? request.method ?? 'GET';

    const promise = fetch(input, init);

    if (window.__RLS_DEBUG && isPostgRESTRequest(url)) {
      promise
        .then((response) => {
          // Async inspection — never blocks the caller
          inspectResponse(url, method, response).catch(() => {
            // Swallow inspection errors so the app is never affected
          });
        })
        .catch(() => {
          // fetch itself failed (network error) — not our concern
        });
    }

    return promise;
  };
}
