// Tracks where every piece of data on screen came from, so the UI can show
// LIVE / CACHED / SIMULATED honestly instead of silently mixing mock data in.

const records = new Map(); // endpoint -> { status, at, endpoint, reason }
const listeners = new Set();

const emit = () => listeners.forEach(fn => fn());

export function recordSource(endpoint, status, { at = Date.now(), reason } = {}) {
  records.set(endpoint.split('?')[0], { endpoint, status, at, reason });
  emit();
}

export function resetSources() {
  records.clear();
  emit();
}

export function getSources() {
  return [...records.values()];
}

export function subscribeSources(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Overall status for a set of records: simulated > stale > cache > live. */
export function summarize(list) {
  if (!list.length) return { status: 'idle', counts: {} };
  const counts = list.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  const status = counts.simulated ? 'simulated' : counts.stale ? 'stale' : counts.cache ? 'cache' : 'live';
  return { status, counts };
}
