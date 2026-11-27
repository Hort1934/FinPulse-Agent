const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Tried in order when the previous model is overloaded, rate-limited or too slow.
// Lighter models are usually still available when the main one is at capacity.
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-flash-lite-latest')
  .split(',').map(m => m.trim()).filter(m => m && m !== MODEL);
const CALL_TIMEOUT_MS = 25_000;

export function geminiKey() {
  const k = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!k || /your_|YOUR_/.test(k)) return null;
  return k;
}

async function call(model, key, body) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    return await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError') return { error: { code: 503, status: 'TIMEOUT', message: `${model} did not answer within ${CALL_TIMEOUT_MS / 1000}s; try again later` } };
    throw err;
  }
}

const isTransient = e => e && (e.code === 503 || e.code === 429 && !/quota/i.test(e.message) || /high demand|overloaded|try again later/i.test(e.message));

/**
 * contents: Gemini-format contents array. Returns { text, model } or { error, status }.
 * Errors are returned, not thrown, so callers can show the real reason
 * (no key, quota exhausted, etc.) instead of a made-up answer.
 */
export async function generate({ system, contents, maxOutputTokens = 2048, temperature = 0.4 }) {
  const key = geminiKey();
  if (!key) return { error: 'Gemini API key is not configured on the server.', status: 'NO_KEY' };
  const body = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    // Gemini 3.x models "think" before answering and those tokens count against
    // maxOutputTokens; keep thinking low so answers are not cut off.
    generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingLevel: 'low' } },
  };
  try {
    let model = MODEL;
    let data = await call(model, key, body);
    for (const next of FALLBACKS) {
      if (!isTransient(data.error)) break;
      model = next;
      data = await call(model, key, body);
    }
    if (data.error) {
      const status = data.error.status || String(data.error.code);
      const reason = data.error.code === 402 || /credits|quota|billing/i.test(data.error.message)
        ? 'Gemini quota or prepaid credits are exhausted for this API key.'
        : isTransient(data.error) ? 'Gemini is overloaded right now. Please try again in a minute.'
        : `Gemini error: ${data.error.message}`;
      return { error: reason, status };
    }
    const cand = data.candidates?.[0];
    const text = cand?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text) return { error: 'Gemini returned an empty response.', status: 'EMPTY' };
    return { text: cand.finishReason === 'MAX_TOKENS' ? `${text}…` : text, model };
  } catch (err) {
    return { error: `Gemini request failed: ${err.message}`, status: 'NETWORK' };
  }
}
