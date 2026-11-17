import { getMockDataForEndpoint } from './mockData';
import { recordSource } from './provenance';

const API_BASE = '/api/soso';

// Retries and rate limiting are handled on the server. If the server cannot
// get real data, the widget falls back to sample data AND records it as
// SIMULATED, so the header badge tells the user exactly what they are seeing.
async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    const data = await res.json();
    if (data._mock || !res.ok || (data.code !== undefined && data.code !== 0)) {
      recordSource(endpoint, 'simulated', { reason: data._meta?.reason || data.message || `HTTP ${res.status}` });
      return getMockDataForEndpoint(endpoint);
    }
    recordSource(endpoint, data._meta?.source || 'live', { at: data._meta?.fetchedAt });
    return data.data !== undefined ? data.data : data;
  } catch (err) {
    recordSource(endpoint, 'simulated', { reason: err.message });
    return getMockDataForEndpoint(endpoint);
  }
}

export async function getSignals({ refresh = false, record = true } = {}) {
  const res = await fetch(`/api/signals${refresh ? '?refresh=1' : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (record) {
    const stale = data.sources?.some(s => s.source === 'stale' || s.source === 'error');
    recordSource('/signals', stale ? 'stale' : 'live', { at: data.generatedAt });
  }
  return data;
}

export async function getExecutions(address) {
  const res = await fetch(`/api/sodex/executions${address ? `?address=${address}` : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function getTradePreview({ symbol, side, usd, address }) {
  const qs = new URLSearchParams({ symbol, side, usd: String(usd), ...(address ? { address } : {}) });
  const res = await fetch(`/api/sodex/preview?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function getCurrencyList() {
  return await fetchAPI('/currencies');
}

export async function getMarketSnapshot(currencyId) {
  return await fetchAPI(`/currencies/${currencyId}/market-snapshot`);
}

export async function getTokenEconomics(currencyId) {
  return await fetchAPI(`/currencies/${currencyId}/token-economics`);
}

export async function getKlines(currencyId, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await fetchAPI(`/currencies/${currencyId}/klines${qs ? '?' + qs : ''}`);
}

export async function getSectorSpotlight() {
  return await fetchAPI('/currencies/sector-spotlight');
}

export async function getETFList(params = { symbol: 'BTC', country_code: 'US' }) {
  const qs = new URLSearchParams(params).toString();
  return await fetchAPI(`/etfs?${qs}`);
}

export async function getETFSummaryHistory() {
  return await fetchAPI('/etfs/summary-history');
}

export async function getETFMarketSnapshot(ticker) {
  return await fetchAPI(`/etfs/${ticker}/market-snapshot`);
}

export async function getIndexList() {
  return await fetchAPI('/indices');
}

export async function getIndexConstituents(ticker) {
  return await fetchAPI(`/indices/${ticker}/constituents`);
}

export async function getIndexMarketSnapshot(ticker) {
  return await fetchAPI(`/indices/${ticker}/market-snapshot`);
}

export async function getIndexKlines(ticker, params = {}) {
  // SoSoValue API requires 'interval' parameter for klines
  const qs = new URLSearchParams({ interval: '1d', ...params }).toString();
  return await fetchAPI(`/indices/${ticker}/klines${qs ? '?' + qs : ''}`);
}

export async function getCryptoStocks() {
  return await fetchAPI('/crypto-stocks');
}

export async function getBTCTreasuries() {
  return await fetchAPI('/btc-treasuries');
}

export async function getBTCPurchaseHistory(ticker) {
  return await fetchAPI(`/btc-treasuries/${ticker}/purchase-history`);
}

export async function getNewsFeed(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await fetchAPI(`/news${qs ? '?' + qs : ''}`);
}

export async function getHotNews() {
  return await fetchAPI('/news/hot');
}

export async function getFeaturedNews() {
  return await fetchAPI('/news/featured');
}

export async function getFundraisingProjects() {
  return await fetchAPI('/fundraising/projects');
}

export async function getFundraisingProjectDetails(projectId) {
  return await fetchAPI(`/fundraising/projects/${projectId}`);
}

export async function getMacroEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await fetchAPI(`/macro/events${qs ? '?' + qs : ''}`);
}

export async function getAnalysisCharts() {
  return await fetchAPI('/analyses');
}

/** Returns { response, dataAsOf } or { error }. Never returns a made-up answer. */
export async function sendChatMessage(messages) {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    return await res.json();
  } catch (err) {
    return { error: `Cannot reach the FinPulse server (${err.message}).` };
  }
}
