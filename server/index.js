import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { soso, ttlFor, apiKey, SoSoError } from './lib/sosovalue.js';
import { computeSignals, UNIVERSE } from './lib/score.js';
import { syncLedger, ledgerSummary } from './lib/ledger.js';
import { generate, geminiKey } from './lib/gemini.js';
import { preview, spotBalances, spotOrders, accountInfo, sodexNetwork, submitExchange, submitSpotOrders, apiKeys, orderFills, orderbook } from './lib/sodex.js';
import { recordExecution, listExecutions } from './lib/executions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// ---------- status ----------
app.get('/api/status', (_req, res) => {
  res.json({
    sosovalue: apiKey() ? 'configured' : 'missing',
    gemini: geminiKey() ? 'configured' : 'missing',
    sodex: sodexNetwork(),
  });
});

// ---------- signals & ledger ----------
async function signalsWithLedger(force) {
  const signals = await computeSignals({ force });
  const db = syncLedger(signals);
  return { signals, ledger: ledgerSummary(db) };
}

app.get('/api/signals', async (req, res) => {
  if (!apiKey()) return res.status(503).json({ error: 'SoSoValue API key is not configured. Signals are never simulated.' });
  try {
    const { signals, ledger } = await signalsWithLedger(req.query.refresh === '1');
    res.json({ ...signals, ledger });
  } catch (err) {
    console.error('signals error:', err);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/ledger', (_req, res) => res.json(ledgerSummary()));

// ---------- SoDEX ----------
app.get('/api/sodex/preview', async (req, res) => {
  const { symbol, side, usd, address } = req.query;
  const amount = Number(usd);
  if (!symbol || !['buy', 'sell'].includes(side) || !(amount > 0) || amount > 1e7) return res.status(400).json({ error: 'symbol, side (buy|sell) and a positive usd amount are required' });
  if (address && !ADDRESS_RE.test(address)) return res.status(400).json({ error: 'invalid address' });
  try {
    let signal = null, eventRisk = null;
    try {
      const s = await computeSignals();
      const a = s.assets.find(x => x.sodexSymbol === symbol);
      if (a) signal = { score: a.score, stance: a.stance };
      eventRisk = s.macro.level;
    } catch { /* preview still works without the score */ }
    res.json(await preview({ symbol, side, usd: amount, address, signal, eventRisk }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/sodex/account/:address', async (req, res) => {
  const { address } = req.params;
  if (!ADDRESS_RE.test(address)) return res.status(400).json({ error: 'invalid address' });
  try {
    const [acc, bal, orders] = await Promise.all([accountInfo(address), spotBalances(address), spotOrders(address).catch(() => null)]);
    res.json({ network: sodexNetwork(), accountID: acc.primaryAccountID, balances: bal.balances, orders });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ---------- SoDEX signed-request relay ----------
// The browser signs; the server only forwards. It validates shape so it can
// never be used as an open proxy, and it never sees a private key.

const NAME_RE = /^[0-9a-zA-Z_-]{1,36}$/;
const HEX_SIG_RE = /^0x0[12][0-9a-fA-F]{130}$/;
const DEC_RE = /^\d+(\.\d*[1-9])?$/;
const isUint = v => Number.isSafeInteger(v) && v >= 0;

app.get('/api/sodex/api-keys/:address', async (req, res) => {
  const { address } = req.params;
  const accountID = Number(req.query.accountID);
  if (!ADDRESS_RE.test(address) || !isUint(accountID)) return res.status(400).json({ error: 'address and accountID required' });
  if (req.query.name && !NAME_RE.test(req.query.name)) return res.status(400).json({ error: 'invalid key name' });
  try { res.json(await apiKeys(address, accountID, req.query.name)); } catch (err) { res.status(502).json({ error: err.message }); }
});

app.post('/api/sodex/exchange/:engine', async (req, res) => {
  const { engine } = req.params;
  const e = req.body || {};
  const p = e.params || {};
  if (!['spot', 'perps'].includes(engine)) return res.status(400).json({ error: 'engine must be spot or perps' });
  if (e.type !== 'addAPIKey' || !isUint(e.nonce) || !isUint(e.signatureChainID) || !HEX_SIG_RE.test(e.signature)
    || !isUint(p.accountID) || !NAME_RE.test(p.name || '') || p.name === 'default' || p.type !== 1
    || !ADDRESS_RE.test(p.publicKey || '') || !isUint(p.expiresAt)) {
    return res.status(400).json({ error: 'malformed addAPIKey envelope' });
  }
  const envelope = {
    type: 'addAPIKey',
    params: { accountID: p.accountID, name: p.name, type: 1, publicKey: p.publicKey, expiresAt: p.expiresAt },
    nonce: e.nonce, signature: e.signature, signatureChainID: e.signatureChainID,
  };
  try {
    const { json } = await submitExchange(engine, envelope);
    res.status(json.code === 0 ? 200 : 502).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

/** Canonical spot batchNewOrder params (Go struct field order). The browser builds the same object before signing. */
function canonicalSpotOrder(p) {
  if (!isUint(p?.accountID) || !Array.isArray(p.orders) || p.orders.length !== 1) return null;
  const o = p.orders[0];
  if (!isUint(o.symbolID) || !NAME_RE.test(o.clOrdID || '') || ![1, 2].includes(o.side) || ![1, 2].includes(o.type)
    || ![1, 2, 3, 4].includes(o.timeInForce) || (o.price !== undefined && !DEC_RE.test(o.price)) || !DEC_RE.test(o.quantity || '')) return null;
  const item = { symbolID: o.symbolID, clOrdID: o.clOrdID, side: o.side, type: o.type, timeInForce: o.timeInForce };
  if (o.price !== undefined) item.price = o.price;
  item.quantity = o.quantity;
  return { accountID: p.accountID, orders: [item] };
}

app.post('/api/sodex/orders', async (req, res) => {
  const { params, auth, context } = req.body || {};
  const canon = canonicalSpotOrder(params);
  if (!canon) return res.status(400).json({ error: 'malformed order' });
  if (!NAME_RE.test(auth?.key || '') || !HEX_SIG_RE.test(auth?.sign || '') || !isUint(auth?.nonce)) return res.status(400).json({ error: 'malformed signature headers' });
  try {
    const { status, json } = await submitSpotOrders(canon, auth);
    recordExecution({
      address: ADDRESS_RE.test(context?.address || '') ? context.address : null,
      symbol: String(context?.symbol || '').slice(0, 32),
      signal: context?.signal ? { score: Number(context.signal.score), stance: String(context.signal.stance).slice(0, 16) } : null,
      expected: context?.expected ? { avgPrice: Number(context.expected.avgPrice), slippagePct: Number(context.expected.slippagePct) } : null,
      order: canon.orders[0], nonce: auth.nonce, keyName: auth.key,
      httpStatus: status, response: json,
    });
    res.status(json.code === 0 ? 200 : 502).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// Execution trail: signal -> order -> exchange result -> actual fills -> mark-to-market.
app.get('/api/sodex/executions', async (req, res) => {
  const { address } = req.query;
  if (address && !ADDRESS_RE.test(address)) return res.status(400).json({ error: 'invalid address' });
  const entries = listExecutions(address);
  const mids = {};
  const enriched = await Promise.all(entries.map(async e => {
    const result = e.response?.data?.[0] || null;
    const out = {
      ts: e.ts, address: e.address, symbol: e.symbol, signal: e.signal, expected: e.expected, order: e.order,
      accepted: e.response?.code === 0 && result?.code === 0,
      orderID: result?.orderID ?? null,
      error: e.response?.code !== 0 ? (e.response?.error || `code ${e.response?.code}`) : result?.code !== 0 ? (result?.error || `code ${result?.code}`) : null,
      fills: [], filledQty: 0, avgFill: null,
    };
    if (out.orderID && e.address) {
      try {
        const fills = await orderFills(e.address, out.orderID);
        out.fills = fills.map(f => ({ price: Number(f.price), quantity: Number(f.quantity), fee: Number(f.fee), feeCoin: f.feeCoin, time: f.time, isMaker: f.isMaker }));
        out.filledQty = out.fills.reduce((s, f) => s + f.quantity, 0);
        out.avgFill = out.filledQty ? out.fills.reduce((s, f) => s + f.price * f.quantity, 0) / out.filledQty : null;
      } catch (err) { out.fillsError = err.message; }
    }
    if (out.avgFill && e.expected?.avgPrice) out.slippageVsExpectedPct = (out.avgFill / e.expected.avgPrice - 1) * 100 * (e.order.side === 1 ? 1 : -1);
    if (out.avgFill) {
      try {
        if (!(e.symbol in mids)) {
          const b = await orderbook(e.symbol, 1);
          mids[e.symbol] = b.bids.length && b.asks.length ? (Number(b.bids[0][0]) + Number(b.asks[0][0])) / 2 : null;
        }
        const mid = mids[e.symbol];
        if (mid) {
          const dir = e.order.side === 1 ? 1 : -1;
          out.markPrice = mid;
          out.unrealizedPnl = dir * (mid - out.avgFill) * out.filledQty;
          out.unrealizedPct = dir * (mid / out.avgFill - 1) * 100;
        }
      } catch { /* mark is optional */ }
    }
    return out;
  }));
  res.json(enriched);
});

// ---------- AI agent ----------
function signalsContext(s) {
  const lines = s.assets.map(a => {
    const c = Object.entries(a.components).map(([k, v]) => `${k}=${v.value ?? 'n/a'} (${v.detail})`).join('; ');
    return `- ${a.symbol}: price $${a.price}, 24h ${(a.change24h * 100).toFixed(2)}%, FinPulse Score ${a.score} → ${a.stance}, confidence ${a.confidence}%. Components: ${c}`;
  });
  const macro = s.macro.upcoming.map(e => `${e.date} ${e.name}${e.highImpact ? ' [HIGH IMPACT]' : ''}`).join('; ') || 'none in next 7 days';
  const pct = x => (x == null ? 'n/a' : `${(x * 100).toFixed(0)}%`);
  const bt = s.backtest.horizons.map(h => `${h.horizonDays}d: ${h.signals} signals (${h.longs} long / ${h.shorts} short), hit rate ${pct(h.hitRate)}, naive same-mix hit rate ${pct(h.naiveHitRate)}, EDGE ${h.edge == null ? 'n/a' : `${h.edge > 0 ? '+' : ''}${(h.edge * 100).toFixed(1)} pp`}`).join('; ');
  const lg = s.ledger ? s.ledger.stats.map(x => `${x.horizonHours}h: ${x.graded} graded${x.graded ? `, hit rate ${pct(x.hitRate)}` : ''}`).join('; ') : 'n/a';
  return `Data timestamp: ${new Date(s.generatedAt).toISOString()} (source: SoSoValue API)
FinPulse Scores (range -100..100, |score|>=25 is directional):
${lines.join('\n')}
Macro event risk: ${s.macro.level}. Upcoming: ${macro}
Backtest (${s.backtest.from}..${s.backtest.to}, price+ETF components only, overlapping windows): ${bt}
How to read the backtest: the market was strongly one-directional, so a high hit rate is mostly the market, not skill. The honest measure is EDGE = hit rate minus the naive same-mix hit rate. Always quote the edge, never compare the hit rate with the raw up-rate.
Live forward-test ledger: ${lg}`;
}

const SYSTEM = ctx => `You are FinPulse AI, a crypto market analyst inside a research-to-execution desk.
Ground every claim in the DATA block below. If the data does not answer the question, say so plainly — never invent numbers, flows or news.
The FinPulse Score is computed deterministically by the app; explain it, do not recompute or override it.
Mention event risk when relevant. You do not give personal financial advice; you describe what the data shows.
Use short markdown (bold, bullets). Keep answers under 200 words unless asked for detail.

DATA:
${ctx}`;

app.post('/api/ai/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
  if (!messages.length) return res.status(400).json({ error: 'messages required' });
  let ctx = 'No live data available (SoSoValue unavailable).';
  try { if (apiKey()) ctx = signalsContext({ ...(await computeSignals()), ledger: ledgerSummary() }); } catch (err) { ctx = `Live data failed to load: ${err.message}`; }
  const r = await generate({
    system: SYSTEM(ctx),
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 4000) }] })),
  });
  if (r.error) return res.json({ error: r.error, status: r.status });
  res.json({ response: r.text, dataAsOf: ctx.match(/Data timestamp: (\S+)/)?.[1] ?? null });
});

// ---------- SoSoValue proxy (dashboard widgets) ----------
app.use('/api/soso', async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ code: -1, message: 'GET only' });
  if (!apiKey()) return res.json({ _mock: true, _meta: { source: 'simulated', reason: 'no_api_key' } });
  try {
    const { data, meta } = await soso(req.url, { ttl: ttlFor(req.url) });
    res.json({ code: 0, data, _meta: meta });
  } catch (err) {
    const code = err instanceof SoSoError ? err.code : -1;
    res.status(502).json({ code, message: err.message, _meta: { source: 'error', path: req.url } });
  }
});

// ---------- built UI (production) ----------
// `npm run build` writes dist/; when it exists this one process serves both the
// API and the app, so a deployment needs a single port and a single service.
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

app.listen(PORT, () => {
  console.log(`\n🚀 FinPulse API on http://localhost:${PORT}`);
  console.log(`   SoSoValue: ${apiKey() ? '✅' : '❌ missing (widgets will show SIMULATED)'}`);
  console.log(`   Gemini:    ${geminiKey() ? '✅' : '❌ missing'}`);
  console.log(`   SoDEX:     ${sodexNetwork().name} (${sodexNetwork().gateway})\n`);
});

// ---------- ledger clock ----------
// Record and grade signals every hour even when nobody has the app open, so each
// horizon is graded within an hour of maturity instead of at the next page view.
if (apiKey()) {
  const tick = () => signalsWithLedger(true).catch(err => console.error('Ledger tick failed:', err.message));
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000);
}

// ---------- Telegram bot ----------
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_TOKEN) {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('🤖 Telegram bot running');
  bot.on('polling_error', e => console.error('Telegram polling error:', e.message));

  const fmtSignal = a => `${a.symbol}  ${a.score > 0 ? '+' : ''}${a.score}  ${a.stance}  (conf ${a.confidence}%)  $${a.price?.toLocaleString()}`;

  bot.onText(/^\/start/, msg => bot.sendMessage(msg.chat.id,
    'FinPulse desk bot.\n/signals — FinPulse Scores for BTC, ETH, SOL, XRP, BNB\n/score BTC — component breakdown\n/track — signal track record\nOr just ask a question.'));

  bot.onText(/^\/signals/, async msg => {
    try {
      const { signals } = await signalsWithLedger(false);
      bot.sendMessage(msg.chat.id, `FinPulse Scores (SoSoValue data, ${new Date(signals.generatedAt).toUTCString()})\n\n${signals.assets.map(fmtSignal).join('\n')}\n\nMacro event risk: ${signals.macro.level}`);
    } catch (e) { bot.sendMessage(msg.chat.id, `Could not load signals: ${e.message}`); }
  });

  bot.onText(/^\/score\s+(\w+)/, async (msg, m) => {
    try {
      const s = await computeSignals();
      const a = s.assets.find(x => x.symbol === m[1].toUpperCase());
      if (!a) return bot.sendMessage(msg.chat.id, `Tracked assets: ${UNIVERSE.map(u => u.symbol).join(', ')}`);
      const parts = Object.entries(a.components).map(([k, v]) => `• ${k} (w${v.weight}): ${v.value ?? 'n/a'} — ${v.detail}`).join('\n');
      bot.sendMessage(msg.chat.id, `${fmtSignal(a)}\n\n${parts}`);
    } catch (e) { bot.sendMessage(msg.chat.id, `Could not load score: ${e.message}`); }
  });

  bot.onText(/^\/track/, msg => {
    const l = ledgerSummary();
    const rows = l.stats.map(s => `${s.horizonHours}h: ${s.graded} graded, hit rate ${s.hitRate == null ? 'n/a' : (s.hitRate * 100).toFixed(0) + '%'}, ${s.pending} pending`).join('\n');
    bot.sendMessage(msg.chat.id, `Signal ledger: ${l.total} signals recorded\n${rows}`);
  });

  bot.on('message', async msg => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return; // stickers, photos, commands
    bot.sendChatAction(msg.chat.id, 'typing');
    let ctx = 'No live data available.';
    try { ctx = signalsContext(await computeSignals()); } catch { /* answer without data */ }
    const r = await generate({
      system: `${SYSTEM(ctx)}\nYou are replying in Telegram: plain text, at most 3 sentences, no markdown.`,
      contents: [{ role: 'user', parts: [{ text: text.slice(0, 2000) }] }],
      maxOutputTokens: 300,
    });
    bot.sendMessage(msg.chat.id, r.error ? `AI unavailable: ${r.error}` : r.text.replace(/[*_`]/g, ''));
  });
}
