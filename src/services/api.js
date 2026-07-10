const API_BASE = '/api/soso';

async function fetchAPI(endpoint, retries = 3, delayMs = 1000) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    const data = await res.json();
    
    // Handle SoSoValue rate limit (code 402901)
    if (data.code === 402901 && retries > 0) {
      console.warn(`Rate limit hit for ${endpoint}. Retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs + Math.random() * 500));
      return fetchAPI(endpoint, retries - 1, delayMs * 1.5);
    }
    
    if (data._mock) return null;
    if (data.data !== undefined) return data.data;
    return data;
  } catch (err) {
    console.warn(`API fetch failed for ${endpoint}:`, err.message);
    return null;
  }
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

export async function getMacroEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await fetchAPI(`/macro/events${qs ? '?' + qs : ''}`);
}

export async function getAnalysisCharts() {
  return await fetchAPI('/analyses');
}

export async function sendChatMessage(messages, context = '') {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    });
    const data = await res.json();
    return data.response;
  } catch (err) {
    return 'Connection error. Please check your server is running.';
  }
}
