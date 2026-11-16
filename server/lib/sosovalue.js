// Server-side SoSoValue client: one rate-limited queue, TTL cache, in-flight
// de-duplication, and provenance metadata on every result so the UI can tell
// LIVE data from CACHED data. Mock data never comes from here.

const BASE = 'https://openapi.sosovalue.com/openapi/v1';
const MIN_GAP_MS = 650; // account limit is 100 req/min -> stay under it
const RATE_LIMIT_CODE = 402901;

const cache = new Map();    // path -> { data, fetchedAt }
const inflight = new Map(); // path -> Promise
let queue = Promise.resolve();
let lastCallAt = 0;

export function apiKey() {
  const k = process.env.SOSOVALUE_API_KEY || process.env.VITE_SOSOVALUE_API_KEY;
  if (!k || /your_|YOUR_/.test(k)) return null;
  return k;
}

export class SoSoError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function schedule(fn) {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function fetchRaw(path) {
  const key = apiKey();
  if (!key) throw new SoSoError('SoSoValue API key is not configured', 'NO_KEY');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await schedule(() => fetch(`${BASE}${path}`, {
      headers: { 'x-soso-api-key': key, Accept: 'application/json' },
    }));
    const json = await res.json().catch(() => null);
    if (!json) throw new SoSoError(`Bad response (${res.status}) for ${path}`, res.status);
    if (json.code === RATE_LIMIT_CODE || res.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (json.code !== 0) throw new SoSoError(json.message || `SoSoValue error ${json.code}`, json.code);
    return json.data;
  }
  throw new SoSoError(`Rate limited on ${path}`, RATE_LIMIT_CODE);
}

/**
 * Fetch a SoSoValue path. Returns { data, meta } where meta.source is
 * 'live' (fresh from the API) or 'cache' (served from memory, with its age).
 * If the API fails but a stale copy exists, the stale copy is returned with
 * meta.source = 'stale' and meta.error set. Throws only when nothing is available.
 */
export async function soso(path, { ttl = 60_000 } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.fetchedAt < ttl) {
    return { data: hit.data, meta: { source: 'cache', fetchedAt: hit.fetchedAt, path } };
  }
  if (!inflight.has(path)) {
    inflight.set(path, fetchRaw(path)
      .then(data => {
        const fetchedAt = Date.now();
        cache.set(path, { data, fetchedAt });
        return { data, meta: { source: 'live', fetchedAt, path } };
      })
      .finally(() => inflight.delete(path)));
  }
  try {
    return await inflight.get(path);
  } catch (err) {
    if (hit) return { data: hit.data, meta: { source: 'stale', fetchedAt: hit.fetchedAt, path, error: err.message } };
    throw err;
  }
}

// Default TTLs per endpoint family, chosen to respect the monthly unit quota.
export function ttlFor(path) {
  if (path.includes('/klines')) return 6 * 3600_000;
  if (path.startsWith('/etfs/summary-history')) return 3600_000;
  if (path.startsWith('/macro')) return 6 * 3600_000;
  if (path.startsWith('/btc-treasuries') || path.startsWith('/fundraising') || path.startsWith('/indices/') && path.includes('constituents')) return 6 * 3600_000;
  if (path.startsWith('/news')) return 10 * 60_000;
  if (path === '/currencies' || path === '/indices') return 24 * 3600_000;
  return 5 * 60_000;
}
