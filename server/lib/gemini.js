const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export function geminiKey() {
  const k = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!k || /your_|YOUR_/.test(k)) return null;
  return k;
}

/**
 * contents: Gemini-format contents array. Returns { text } or { error, status }.
 * Errors are returned, not thrown, so callers can show the real reason
 * (no key, quota exhausted, etc.) instead of a made-up answer.
 */
export async function generate({ system, contents, maxOutputTokens = 1024, temperature = 0.4 }) {
  const key = geminiKey();
  if (!key) return { error: 'Gemini API key is not configured on the server.', status: 'NO_KEY' };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature, maxOutputTokens },
      }),
    });
    const data = await res.json();
    if (data.error) {
      const status = data.error.status || String(data.error.code);
      const reason = data.error.code === 402 || /credits|quota|billing/i.test(data.error.message)
        ? 'Gemini quota or prepaid credits are exhausted for this API key.'
        : `Gemini error: ${data.error.message}`;
      return { error: reason, status };
    }
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!text) return { error: 'Gemini returned an empty response.', status: 'EMPTY' };
    return { text };
  } catch (err) {
    return { error: `Gemini request failed: ${err.message}`, status: 'NETWORK' };
  }
}
