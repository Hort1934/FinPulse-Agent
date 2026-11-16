import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { soso, ttlFor, apiKey, SoSoError } from './lib/sosovalue.js';
import { computeSignals, UNIVERSE } from './lib/score.js';
import { syncLedger, ledgerSummary } from './lib/ledger.js';
import { generate, geminiKey } from './lib/gemini.js';
import { preview, spotBalances, spotOrders, accountInfo, sodexNetwork } from './lib/sodex.js';

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

// ---------- AI agent ----------
function signalsContext(s) {
  const lines = s.assets.map(a => {
    const c = Object.entries(a.components).map(([k, v]) => `${k}=${v.value ?? 'n/a'} (${v.detail})`).join('; ');
    return `- ${a.symbol}: price $${a.price}, 24h ${(a.change24h * 100).toFixed(2)}%, FinPulse Score ${a.score} → ${a.stance}, confidence ${a.confidence}%. Components: ${c}`;
  });
  const macro = s.macro.upcoming.map(e => `${e.date} ${e.name}${e.highImpact ? ' [HIGH IMPACT]' : ''}`).join('; ') || 'none in next 7 days';
  const bt = s.backtest.horizons.map(h => `${h.horizonDays}d: ${h.signals} signals, hit rate ${h.hitRate == null ? 'n/a' : (h.hitRate * 100).toFixed(0) + '%'} vs base up-rate ${(h.baselineUpRate * 100).toFixed(0)}%`).join('; ');
  return `Data timestamp: ${new Date(s.generatedAt).toISOString()} (source: SoSoValue API)
FinPulse Scores (range -100..100, |score|>=25 is directional):
${lines.join('\n')}
Macro event risk: ${s.macro.level}. Upcoming: ${macro}
Backtest (${s.backtest.from}..${s.backtest.to}, price+ETF components only): ${bt}`;
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
  try { if (apiKey()) ctx = signalsContext(await computeSignals()); } catch (err) { ctx = `Live data failed to load: ${err.message}`; }
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

app.listen(PORT, () => {
  console.log(`\n🚀 FinPulse API on http://localhost:${PORT}`);
  console.log(`   SoSoValue: ${apiKey() ? '✅' : '❌ missing (widgets will show SIMULATED)'}`);
  console.log(`   Gemini:    ${geminiKey() ? '✅' : '❌ missing'}`);
  console.log(`   SoDEX:     ${sodexNetwork().name} (${sodexNetwork().gateway})\n`);
});

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
