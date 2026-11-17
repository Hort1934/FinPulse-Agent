// SoDEX read-side + pre-trade risk engine. Orders are signed in the user's
// wallet (browser); this module never holds a private key. It only prices an
// order against the live order book and decides whether it passes risk rules.

export const NETWORKS = {
  testnet: { gateway: 'https://testnet-gw.sodex.dev/api/v1', chainId: 138565 },
  mainnet: { gateway: 'https://mainnet-gw.sodex.dev/api/v1', chainId: 286623 },
};
const NET = NETWORKS[process.env.SODEX_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'];
export const sodexNetwork = () => ({ name: process.env.SODEX_NETWORK === 'mainnet' ? 'mainnet' : 'testnet', ...NET });

export const RISK_LIMITS = {
  maxSlippagePct: 0.5,     // worst acceptable avg-fill vs mid
  maxOrderPctOfBalance: 25,// single order may not exceed 25% of quote balance
  maxSpreadPct: 1.0,       // refuse to trade into a broken book
};

async function get(path) {
  const res = await fetch(`${NET.gateway}${path}`, { headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => null);
  if (!json || json.code !== 0) throw new Error(json?.error || json?.message || `SoDEX ${res.status} on ${path}`);
  return json.data;
}

let symbolsCache = null;
export async function spotSymbols() {
  if (symbolsCache && Date.now() - symbolsCache.at < 10 * 60_000) return symbolsCache.data;
  const data = await get('/spot/markets/symbols');
  symbolsCache = { at: Date.now(), data };
  return data;
}

export const orderbook = (symbol, limit = 50) => get(`/spot/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`);
export const ticker = symbol => get(`/spot/markets/tickers?symbol=${encodeURIComponent(symbol)}`).then(d => d?.[0] ?? null);
export const accountInfo = addr => get(`/user/${addr}/subaccounts`);
export const spotBalances = addr => get(`/spot/accounts/${addr}/balances`);
export const spotOrders = addr => get(`/spot/accounts/${addr}/orders`);

const decimals = step => (String(step).split('.')[1] || '').replace(/0+$/, '').length;
const floorTo = (x, step) => Math.floor(x / Number(step) + 1e-9) * Number(step);
// SoDEX rejects decimal strings with trailing zeros ("0.4060" fails, "0.406" works).
export const trimDecimal = s => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

// ---------- signed-request relay (signatures are produced in the user's browser) ----------

async function send(method, path, body, headers = {}) {
  const res = await fetch(`${NET.gateway}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ code: -1, error: `HTTP ${res.status} with non-JSON body` }));
  return { status: res.status, json };
}

/** addAPIKey / revokeAPIKey envelopes, signed by the master wallet. */
export const submitExchange = (engine, envelope) => send('POST', `/${engine}/exchange`, envelope);

/** Spot batch new order, signed by the session API key. */
export const submitSpotOrders = (params, { key, sign, nonce }) => send('POST', '/spot/trade/orders/batch', params, {
  'X-API-Key': key, 'X-API-Sign': sign, 'X-API-Nonce': String(nonce), 'X-API-Chain': String(NET.chainId),
});

export const apiKeys = (address, accountID, name) => {
  const qs = new URLSearchParams({ accountID: String(accountID), ...(name ? { name } : {}) });
  return get(`/user/${address}/api-keys?${qs}`);
};

/** Walk the book to fill `usd` of quote (buy) or `usd` worth of base (sell). */
export function simulateFill(book, side, usd) {
  const levels = (side === 'buy' ? book.asks : book.bids).map(([p, q]) => [Number(p), Number(q)]);
  let remainingUsd = usd, qty = 0, cost = 0, levelsUsed = 0;
  for (const [p, q] of levels) {
    if (remainingUsd <= 1e-9) break;
    const takeQty = Math.min(q, remainingUsd / p);
    qty += takeQty; cost += takeQty * p; remainingUsd -= takeQty * p; levelsUsed++;
  }
  return { filledUsd: cost, qty, avgPrice: qty ? cost / qty : null, unfilledUsd: Math.max(0, remainingUsd), levelsUsed, worstPrice: levelsUsed ? levels[levelsUsed - 1][0] : null };
}

/**
 * Price an order and run risk rules.
 * side: 'buy' | 'sell'; usd: notional in quote; address optional (for balance checks);
 * signal/macro optional: FinPulse context so the desk can warn against the score.
 */
export async function preview({ symbol, side, usd, address, signal, eventRisk }) {
  const symbols = await spotSymbols();
  const m = symbols.find(s => s.name === symbol);
  if (!m) throw new Error(`Unknown SoDEX spot market ${symbol}`);
  const [book, t] = await Promise.all([orderbook(symbol), ticker(symbol).catch(() => null)]);
  const bestBid = book.bids.length ? Number(book.bids[0][0]) : null;
  const bestAsk = book.asks.length ? Number(book.asks[0][0]) : null;
  const twoSided = bestBid != null && bestAsk != null;
  const mid = twoSided ? (bestBid + bestAsk) / 2 : (bestBid ?? bestAsk);
  const spreadPct = twoSided ? ((bestAsk - bestBid) / mid) * 100 : null;
  const fill = simulateFill(book, side, usd);
  const slippagePct = fill.avgPrice && mid ? Math.abs(fill.avgPrice / mid - 1) * 100 : null;
  if (!mid) {
    return {
      network: sodexNetwork().name, chainId: NET.chainId,
      market: { symbol: m.name, symbolID: m.id, base: m.baseCoin, quote: m.quoteCoin, tickSize: m.tickSize, stepSize: m.stepSize, takerFee: Number(m.takerFee) },
      book: { bestBid, bestAsk, mid: null, spreadPct: null, blockHeight: book.blockHeight, lastPx: t ? Number(t.lastPx) : null },
      fill, order: null, account: null, limits: RISK_LIMITS, blocked: true,
      checks: [{ id: 'liquidity', ok: false, level: 'block', message: `The SoDEX ${sodexNetwork().name} order book for ${m.name} is empty — there is nothing to trade against.` }],
    };
  }
  const takerFee = Number(m.takerFee);

  let balances = null, quoteFree = null, baseFree = null, accountID = null;
  if (address) {
    try {
      const [acc, bal] = await Promise.all([accountInfo(address), spotBalances(address)]);
      accountID = acc.primaryAccountID;
      balances = bal.balances;
      const free = coin => { const b = bal.balances.find(x => x.coin === coin); return b ? Number(b.total) - Number(b.locked) : 0; };
      quoteFree = free(m.quoteCoin); baseFree = free(m.baseCoin);
    } catch { /* account may not exist on this network yet */ }
  }

  // Order we would send: IOC limit at the worst price we accept (mid ± max slippage),
  // so the exchange itself enforces the slippage cap.
  const capPx = side === 'buy' ? mid * (1 + RISK_LIMITS.maxSlippagePct / 100) : mid * (1 - RISK_LIMITS.maxSlippagePct / 100);
  const pxDec = decimals(m.tickSize), qtyDec = decimals(m.stepSize);
  const limitPrice = side === 'buy' ? Math.ceil(capPx / Number(m.tickSize)) * Number(m.tickSize) : floorTo(capPx, m.tickSize);
  const quantity = floorTo(usd / mid, m.stepSize);

  const checks = [];
  const add = (id, ok, level, message) => checks.push({ id, ok, level, message });
  add('minNotional', usd >= Number(m.minNotional), 'block', `Minimum order is ${m.minNotional} ${m.quoteCoin}`);
  add('minQty', quantity >= Number(m.minQuantity), 'block', `Quantity ${quantity.toFixed(qtyDec)} vs minimum ${m.minQuantity}`);
  add('spread', spreadPct != null && spreadPct <= RISK_LIMITS.maxSpreadPct, 'block', spreadPct == null
    ? `One-sided book: no ${bestBid == null ? 'bids' : 'asks'} on SoDEX ${sodexNetwork().name}`
    : `Spread ${spreadPct.toFixed(3)}% (limit ${RISK_LIMITS.maxSpreadPct}%)`);
  add('depth', fill.unfilledUsd < 0.01, 'block', fill.unfilledUsd < 0.01 ? `Book depth covers the order across ${fill.levelsUsed} level(s)` : `Book only has ${fill.filledUsd.toFixed(2)} USD on the ${side === 'buy' ? 'ask' : 'bid'} side`);
  add('slippage', slippagePct != null && slippagePct <= RISK_LIMITS.maxSlippagePct, 'block', `Expected slippage ${slippagePct?.toFixed(3) ?? '—'}% (limit ${RISK_LIMITS.maxSlippagePct}%)`);
  if (address) {
    if (side === 'buy') add('balance', quoteFree != null && quoteFree >= usd * (1 + takerFee), 'block', `Free ${m.quoteCoin}: ${quoteFree?.toFixed(2) ?? 0}`);
    else add('balance', baseFree != null && baseFree >= quantity, 'block', `Free ${m.baseCoin}: ${baseFree ?? 0}`);
    if (side === 'buy' && quoteFree) add('sizing', (usd / quoteFree) * 100 <= RISK_LIMITS.maxOrderPctOfBalance, 'warn', `Order is ${((usd / quoteFree) * 100).toFixed(0)}% of free balance (guideline ≤ ${RISK_LIMITS.maxOrderPctOfBalance}%)`);
  }
  if (signal) {
    const against = (side === 'buy' && signal.stance === 'REDUCE') || (side === 'sell' && signal.stance === 'ACCUMULATE');
    add('signal', !against, 'warn', `FinPulse Score ${signal.score} (${signal.stance}) — ${against ? 'order goes against the signal' : 'order is consistent with the signal'}`);
  }
  if (eventRisk) add('macro', eventRisk !== 'high', 'warn', `Macro event risk: ${eventRisk}`);

  const blocked = checks.some(c => !c.ok && c.level === 'block');
  return {
    network: sodexNetwork().name, chainId: NET.chainId,
    market: { symbol: m.name, symbolID: m.id, base: m.baseCoin, quote: m.quoteCoin, tickSize: m.tickSize, stepSize: m.stepSize, takerFee },
    book: { bestBid, bestAsk, mid, spreadPct, blockHeight: book.blockHeight, lastPx: t ? Number(t.lastPx) : null },
    fill: { ...fill, slippagePct, estFee: fill.filledUsd * takerFee },
    order: {
      side, type: 'LIMIT', timeInForce: 'IOC',
      price: trimDecimal(limitPrice.toFixed(pxDec)), quantity: trimDecimal(quantity.toFixed(qtyDec)),
      symbolID: m.id, pricedAt: Date.now(),
      note: `IOC limit at ${RISK_LIMITS.maxSlippagePct}% from mid: the exchange rejects any fill worse than this.`,
    },
    account: address ? { address, accountID, balances } : null,
    checks, blocked, limits: RISK_LIMITS,
  };
}
