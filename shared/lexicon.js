// Shared, documented classification rules used by both the server (FinPulse
// Score) and the UI (News Intel, Macro Radar), so every screen labels data the
// same way. These are transparent keyword rules, not an AI model.

export const BULL = /\b(surg\w*|soar\w*|rall(y|ies|ied)|record high|inflows?|approv\w*|adopt\w*|accumulat\w*|bullish|breakout|gains?|rises?|rebound\w*|upgrade\w*|partnership)\b/gi;
export const BEAR = /\b(plung\w*|crash\w*|drops?|dropped|falls?|fell|outflows?|hack\w*|exploit\w*|leak\w*|sell-?off|bearish|liquidat\w*|lawsuit|bans?|banned|reject\w*|declin\w*|slump\w*|fraud|investigation|delist\w*)\b/gi;

/** Count bullish vs bearish terms (whole words only). */
export function toneOf(text) {
  const t = String(text || '');
  const bull = (t.match(BULL) || []).length;
  const bear = (t.match(BEAR) || []).length;
  return { bull, bear, tone: bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'neutral' };
}

// Macro event impact on crypto, by event name.
export const HIGH_IMPACT = /\b(CPI|PCE|FOMC|Fed|Interest Rate|Nonfarm|Payrolls|GDP|Unemployment Rate|Powell)\b/i;
export const MEDIUM_IMPACT = /\b(PPI|Retail Sales|PMI|ISM|Consumer Confidence|Consumer Sentiment|JOLTS|Durable Goods|Housing Starts|Industrial Production)\b/i;

export function impactOf(name) {
  if (HIGH_IMPACT.test(name)) return 'high';
  if (MEDIUM_IMPACT.test(name)) return 'medium';
  return 'low';
}

export const IMPACT_RULES = {
  high: 'CPI, PCE, FOMC / Fed / rate decisions, payrolls, GDP, unemployment rate',
  medium: 'PPI, retail sales, PMI / ISM, consumer confidence, JOLTS, durable goods, housing starts, industrial production',
  low: 'everything else (e.g. jobless claims, home sales)',
};
