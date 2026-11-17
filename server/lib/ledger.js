// Signal ledger: every live FinPulse signal is stored with the price at issue,
// then graded against the live price once each horizon has passed. This is the
// forward-test record (the backtest in score.js is the historical one).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THRESHOLD } from './score.js';

// DATA_DIR lets a deployment keep the ledger on a persistent volume.
const DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DIR, 'ledger.json');
const MIN_GAP_MS = 6 * 3600_000; // one entry per asset per 6h, unless the stance flips
export const HORIZONS_H = [24, 72, 168];

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { entries: [] }; }
}
function write(db) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

/** Record new signals from a computeSignals() result and grade matured ones. */
export function syncLedger(signals) {
  const db = read();
  const now = Date.now();
  let changed = false;
  const priceBy = Object.fromEntries(signals.assets.map(a => [a.symbol, a.price]));

  for (const a of signals.assets) {
    if (a.score == null || !a.price) continue;
    const last = db.entries.filter(e => e.symbol === a.symbol).at(-1);
    if (last && now - last.ts < MIN_GAP_MS && last.stance === a.stance) continue;
    db.entries.push({
      id: `${a.symbol}-${now}`, symbol: a.symbol, ts: now,
      score: a.score, stance: a.stance, confidence: a.confidence,
      direction: a.score >= THRESHOLD ? 1 : a.score <= -THRESHOLD ? -1 : 0,
      price: a.price, eventRisk: a.eventRisk, outcomes: {},
    });
    changed = true;
  }

  for (const e of db.entries) {
    for (const h of HORIZONS_H) {
      if (e.outcomes[h] || now < e.ts + h * 3600_000 || !priceBy[e.symbol]) continue;
      const ret = priceBy[e.symbol] / e.price - 1;
      e.outcomes[h] = {
        gradedAt: now, price: priceBy[e.symbol], ret,
        // graded at first check after maturity; lateness is stored so it can be audited
        lateByMin: Math.round((now - (e.ts + h * 3600_000)) / 60_000),
        hit: e.direction === 0 ? null : Math.sign(ret) === e.direction,
      };
      changed = true;
    }
  }
  if (changed) write(db);
  return db;
}

export function ledgerSummary(db = read()) {
  const stats = HORIZONS_H.map(h => {
    const graded = db.entries.filter(e => e.direction !== 0 && e.outcomes[h]);
    const hits = graded.filter(e => e.outcomes[h].hit).length;
    return {
      horizonHours: h,
      graded: graded.length,
      pending: db.entries.filter(e => e.direction !== 0 && !e.outcomes[h]).length,
      hitRate: graded.length ? hits / graded.length : null,
      avgSignedReturn: graded.length ? graded.reduce((s, e) => s + e.direction * e.outcomes[h].ret, 0) / graded.length : null,
    };
  });
  return { total: db.entries.length, since: db.entries[0]?.ts ?? null, stats, recent: db.entries.slice(-30).reverse() };
}
