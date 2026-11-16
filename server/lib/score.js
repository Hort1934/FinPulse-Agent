// FinPulse Score: a transparent, deterministic multi-factor score per asset.
// Every component is normalised to [-1, 1]; the score is their weighted mean
// scaled to [-100, 100]. Missing components are dropped and their weight is
// redistributed, which lowers the reported coverage/confidence.
// The AI layer only *explains* this output; it never produces the number.

import { soso, ttlFor } from './sosovalue.js';

export const UNIVERSE = [
  { symbol: 'BTC', name: 'Bitcoin', id: '1673723677362319866', etf: 'BTC', sector: 'BTC', sodex: 'vBTC_vUSDC', keywords: /\b(bitcoin|btc)\b/i },
  { symbol: 'ETH', name: 'Ethereum', id: '1673723677362319867', etf: 'ETH', sector: 'ETH', sodex: 'vETH_vUSDC', keywords: /\b(ethereum|eth|ether)\b/i },
  { symbol: 'SOL', name: 'Solana', id: '1673723677362319875', etf: 'SOL', sector: 'Layer1', sodex: 'vSOL_vUSDC', keywords: /\b(solana|sol)\b/i },
  { symbol: 'XRP', name: 'XRP', id: '1673723677362319871', etf: 'XRP', sector: 'PayFi', sodex: 'vXRP_vUSDC', keywords: /\b(xrp|ripple)\b/i },
  { symbol: 'BNB', name: 'BNB', id: '1673723677362319869', etf: null, sector: 'CeFi', sodex: 'vBNB_vUSDC', keywords: /\b(bnb|binance)\b/i },
];

export const WEIGHTS = {
  etfFlow: 25,       // institutional demand: 5-day avg ETF net flow vs its own volatility
  momentum: 25,      // volatility-adjusted 1d/7d/30d returns
  trend: 15,         // SMA20 vs SMA50 regime
  participation: 10, // volume vs 20-day average, signed by price direction
  sector: 10,        // 24h move of the asset's SoSoValue sector
  news: 15,          // lexicon sentiment of SoSoValue hot news mentioning the asset
};

export const THRESHOLD = 25; // |score| >= 25 -> directional stance

const HIGH_IMPACT = /\b(CPI|PCE|FOMC|Fed|Interest Rate|Nonfarm|Payrolls|GDP|Unemployment Rate|Powell)\b/i;
const BULL = /\b(surg\w*|soar\w*|rall(y|ies|ied)|record high|inflows?|approv\w*|adopt\w*|accumulat\w*|bullish|breakout|gains?|rises?|rebound\w*|upgrade\w*|partnership)\b/gi;
const BEAR = /\b(plung\w*|crash\w*|drops?|dropped|falls?|fell|outflows?|hack\w*|exploit\w*|leak\w*|sell-?off|bearish|liquidat\w*|lawsuit|bans?|banned|reject\w*|declin\w*|slump\w*|fraud|investigation|delist\w*)\b/gi;

const DAY = 86_400_000;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const fmtUsd = v => `${v < 0 ? '-' : ''}$${(Math.abs(v) / 1e6).toFixed(1)}M`;

// ---------- pure component functions (shared by live score and backtest) ----------

/** closes: ascending daily closes ending at the evaluation point. */
export function priceComponents(closes) {
  if (closes.length < 51) return { momentum: null, trend: null };
  const rets = [];
  for (let i = Math.max(1, closes.length - 60); i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const sigma = std(rets) || 1e-9;
  const t = closes.length - 1;
  const r1 = Math.log(closes[t] / closes[t - 1]);
  const r7 = Math.log(closes[t] / closes[t - 7]);
  const r30 = Math.log(closes[t] / closes[t - 30]);
  const tstat = 0.2 * (r1 / sigma) + 0.4 * (r7 / (sigma * Math.sqrt(7))) + 0.4 * (r30 / (sigma * Math.sqrt(30)));
  const sma20 = mean(closes.slice(-20));
  const sma50 = mean(closes.slice(-50));
  return {
    momentum: { value: Math.tanh(tstat / 1.5), detail: `1d ${(r1 * 100).toFixed(1)}%, 7d ${(r7 * 100).toFixed(1)}%, 30d ${(r30 * 100).toFixed(1)}% (daily σ ${(sigma * 100).toFixed(1)}%)` },
    trend: { value: Math.tanh((sma20 / sma50 - 1) / (sigma * 1.5)), detail: `SMA20 ${sma20 > sma50 ? 'above' : 'below'} SMA50 by ${(Math.abs(sma20 / sma50 - 1) * 100).toFixed(1)}%` },
  };
}

/** flows: ascending daily ETF net flows (USD) ending at the evaluation point. */
export function etfComponent(flows) {
  if (!flows || flows.length < 8) return null;
  const s = std(flows);
  if (!s) return null;
  const last5 = mean(flows.slice(-5));
  return { value: Math.tanh(last5 / s), detail: `5d avg net flow ${fmtUsd(last5)} vs typical daily swing ${fmtUsd(s)}` };
}

/** volumes: ascending daily volumes of completed candles; dir: sign of last return. */
export function participationComponent(volumes, dir) {
  if (volumes.length < 21) return null;
  const avg = mean(volumes.slice(-21, -1));
  if (!avg) return null;
  const ratio = volumes[volumes.length - 1] / avg;
  return { value: Math.sign(dir) * Math.tanh(Math.log(ratio)), detail: `volume ${ratio.toFixed(2)}× 20-day avg on ${dir >= 0 ? 'an up' : 'a down'} day` };
}

function sectorComponent(sectors, name) {
  const s = sectors?.find(x => x.name === name);
  if (!s) return null;
  return { value: Math.tanh((s.change_pct_24h * 100) / 3), detail: `${name} sector ${(s.change_pct_24h * 100).toFixed(2)}% in 24h` };
}

function newsComponent(articles, re) {
  let bull = 0, bear = 0, n = 0;
  const hits = [];
  for (const a of articles) {
    const text = `${a.title} ${(a.content || '').slice(0, 400)}`;
    if (!re.test(text)) continue;
    n++;
    const b = (text.match(BULL) || []).length, r = (text.match(BEAR) || []).length;
    bull += b; bear += r;
    if (hits.length < 3) hits.push({ title: a.title, link: a.source_link, tone: b > r ? 'bullish' : r > b ? 'bearish' : 'neutral' });
  }
  if (!n) return null;
  return { value: (bull - bear) / (bull + bear + 2), detail: `${n} articles: ${bull} bullish vs ${bear} bearish terms`, headlines: hits };
}

export function combine(components, weights = WEIGHTS) {
  let wSum = 0, acc = 0, wAll = 0;
  for (const [k, w] of Object.entries(weights)) {
    wAll += w;
    const c = components[k];
    if (c && Number.isFinite(c.value)) { wSum += w; acc += w * c.value; }
  }
  if (!wSum) return { score: null, coverage: 0 };
  return { score: Math.round((100 * acc) / wSum), coverage: wSum / wAll };
}

export function stanceFor(score) {
  if (score == null) return 'NO DATA';
  if (score >= THRESHOLD) return 'ACCUMULATE';
  if (score <= -THRESHOLD) return 'REDUCE';
  return 'NEUTRAL';
}

function macroRisk(events) {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const upcoming = [];
  for (const d of events || []) {
    const days = Math.round((new Date(d.date).getTime() - today) / DAY);
    if (days < 0 || days > 7) continue;
    for (const name of d.events) upcoming.push({ date: d.date, daysAway: days, name: name.trim(), highImpact: HIGH_IMPACT.test(name) });
  }
  const hi = upcoming.filter(e => e.highImpact);
  let level = 'low';
  if (hi.some(e => e.daysAway <= 1)) level = 'high';
  else if (hi.some(e => e.daysAway <= 2) || upcoming.some(e => e.daysAway === 0)) level = 'medium';
  return { level, upcoming };
}

// ---------- data loading ----------

async function load(path, sources) {
  try {
    const r = await soso(path, { ttl: ttlFor(path) });
    sources.push(r.meta);
    return r.data;
  } catch (err) {
    sources.push({ source: 'error', path, error: err.message });
    return null;
  }
}

function completedCandles(klines) {
  const arr = (Array.isArray(klines) ? klines : klines?.list || [])
    .map(k => ({ t: Number(k.timestamp), close: Number(k.close), volume: Number(k.volume) }))
    .filter(k => Number.isFinite(k.close))
    .sort((a, b) => a.t - b.t);
  return arr.filter(k => k.t + DAY <= Date.now());
}

let memo = null;
const MEMO_TTL = 5 * 60_000;

export async function computeSignals({ force = false } = {}) {
  if (!force && memo && Date.now() - memo.generatedAt < MEMO_TTL) return memo;
  const sources = [];
  const [sectorData, news, macro] = [
    await load('/currencies/sector-spotlight', sources),
    await load('/news/hot', sources),
    await load('/macro/events', sources),
  ];
  const articles = news?.list || [];
  const risk = macroRisk(macro);

  const assets = [];
  const backtestRows = [];
  for (const a of UNIVERSE) {
    const snap = await load(`/currencies/${a.id}/market-snapshot`, sources);
    const kl = await load(`/currencies/${a.id}/klines?interval=1d&limit=120`, sources);
    const etf = a.etf ? await load(`/etfs/summary-history?symbol=${a.etf}&country_code=US`, sources) : null;

    const candles = kl ? completedCandles(kl) : [];
    const closes = candles.map(c => c.close);
    if (snap?.price) closes.push(snap.price); // evaluate at the live price
    const flows = (etf || []).slice().sort((x, y) => x.date.localeCompare(y.date)).map(f => Number(f.total_net_inflow));

    const pc = priceComponents(closes);
    const lastRet = candles.length > 1 ? candles.at(-1).close - candles.at(-2).close : 0;
    const components = {
      etfFlow: etfComponent(flows),
      momentum: pc.momentum,
      trend: pc.trend,
      participation: participationComponent(candles.map(c => c.volume), lastRet),
      sector: sectorComponent(sectorData?.sector, a.sector),
      news: newsComponent(articles, a.keywords),
    };
    const { score, coverage } = combine(components);
    const avail = Object.values(components).filter(Boolean);
    const agree = score == null ? 0 : avail.filter(c => Math.sign(c.value) === Math.sign(score) || Math.abs(c.value) < 0.1).length / avail.length;
    const riskFactor = risk.level === 'high' ? 0.75 : risk.level === 'medium' ? 0.9 : 1;
    const confidence = score == null ? 0 : Math.round(100 * coverage * (0.5 + 0.5 * agree) * riskFactor);

    assets.push({
      symbol: a.symbol, name: a.name, currencyId: a.id, sodexSymbol: a.sodex,
      price: snap?.price ?? null,
      change24h: snap?.change_pct_24h ?? null,
      marketCap: snap?.marketcap ?? null,
      score, stance: stanceFor(score), confidence, coverage: round(coverage, 2),
      components: Object.fromEntries(Object.entries(components).map(([k, c]) => [k, c ? { ...c, value: round(c.value), weight: WEIGHTS[k] } : { value: null, weight: WEIGHTS[k], detail: 'no data' }])),
      eventRisk: risk.level,
    });

    backtestRows.push(...backtestAsset(a.symbol, candles, etf));
  }

  memo = {
    generatedAt: Date.now(),
    methodology: { weights: WEIGHTS, threshold: THRESHOLD },
    macro: risk,
    assets: assets.sort((x, y) => Math.abs(y.score ?? 0) - Math.abs(x.score ?? 0)),
    backtest: summarizeBacktest(backtestRows),
    sources,
  };
  return memo;
}

// ---------- walk-forward backtest (no look-ahead) ----------
// Only components with history are used: momentum, trend, participation, and
// ETF flow where the ETF history covers the date. Sector and news snapshots
// have no history in the API, so they are excluded and the UI says so.

const BT_WEIGHTS = { etfFlow: WEIGHTS.etfFlow, momentum: WEIGHTS.momentum, trend: WEIGHTS.trend, participation: WEIGHTS.participation };
const HORIZONS = [1, 3, 7];

function backtestAsset(symbol, candles, etf) {
  const flowsByDate = (etf || []).slice().sort((x, y) => x.date.localeCompare(y.date));
  const rows = [];
  for (let t = 50; t < candles.length - 1; t++) {
    const closes = candles.slice(0, t + 1).map(c => c.close);
    const date = new Date(candles[t].t).toISOString().slice(0, 10);
    const flows = flowsByDate.filter(f => f.date <= date).map(f => Number(f.total_net_inflow));
    const pc = priceComponents(closes);
    const comps = {
      etfFlow: etfComponent(flows),
      momentum: pc.momentum,
      trend: pc.trend,
      participation: participationComponent(candles.slice(0, t + 1).map(c => c.volume), closes[t] - closes[t - 1]),
    };
    const { score } = combine(comps, BT_WEIGHTS);
    const fwd = {};
    for (const h of HORIZONS) if (t + h < candles.length) fwd[h] = candles[t + h].close / candles[t].close - 1;
    rows.push({ symbol, date, score, fwd });
  }
  return rows;
}

function summarizeBacktest(rows) {
  const horizons = HORIZONS.map(h => {
    const valid = rows.filter(r => r.fwd[h] != null);
    const signals = valid.filter(r => r.score != null && Math.abs(r.score) >= THRESHOLD);
    const signed = signals.map(r => Math.sign(r.score) * r.fwd[h]);
    const hits = signed.filter(x => x > 0).length;
    const baselineUp = valid.filter(r => r.fwd[h] > 0).length;
    const upRate = valid.length ? baselineUp / valid.length : 0;
    // What a coin-flip with the same long/short mix would have scored in this market:
    const longs = signals.filter(r => r.score > 0).length;
    const naive = signals.length ? (longs * upRate + (signals.length - longs) * (1 - upRate)) / signals.length : null;
    return {
      naiveHitRate: naive == null ? null : round(naive, 3),
      edge: naive == null || !signals.length ? null : round(hits / signals.length - naive, 3),
      horizonDays: h,
      signals: signals.length,
      longs: signals.filter(r => r.score > 0).length,
      shorts: signals.filter(r => r.score < 0).length,
      hitRate: signals.length ? round(hits / signals.length, 3) : null,
      avgSignedReturn: signals.length ? round(mean(signed), 4) : null,
      baselineUpRate: valid.length ? round(baselineUp / valid.length, 3) : null,
      days: valid.length,
    };
  });
  const dates = rows.map(r => r.date).sort();
  return {
    from: dates[0] ?? null, to: dates.at(-1) ?? null, horizons,
    componentsUsed: Object.keys(BT_WEIGHTS),
    note: 'Walk-forward on daily candles; each day is scored with data available up to that day only. Sector and news components have no history in the API and are excluded. Overlapping windows: samples are not independent. "Edge" compares the hit rate with a random strategy that has the same long/short mix in the same market; in a one-way market a high hit rate alone proves little.',
  };
}
