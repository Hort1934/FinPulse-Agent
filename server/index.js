import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SOSOVALUE_BASE = 'https://openapi.sosovalue.com/openapi/v1';

app.use(cors());
app.use(express.json());

const apiCache = new Map();
const CACHE_TTL = 60 * 1000;

// Proxy middleware for SoSoValue API
async function proxyToSoSoValue(req, res) {
  const apiPath = req.url; // app.use strips the mount prefix
  const url = `${SOSOVALUE_BASE}${apiPath}`;
  const apiKey = process.env.VITE_SOSOVALUE_API_KEY;

  if (!apiKey || apiKey === 'your_sosovalue_api_key_here') {
    return res.status(200).json({ _mock: true, _message: 'No API key configured. Using mock data.' });
  }

  if (req.method === 'GET') {
    const cached = apiCache.get(url);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json(cached.data);
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'x-soso-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    
    if (req.method === 'GET' && data.code !== 402901) {
      apiCache.set(url, { time: Date.now(), data });
    }
    
    res.json(data);
  } catch (error) {
    console.error(`Proxy error for ${url}:`, error.message);
    res.status(502).json({ error: 'Failed to fetch from SoSoValue API', details: error.message });
  }
}

// Gemini AI proxy
app.post('/api/ai/chat', async (req, res) => {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.json({
      response: "AI chat is in demo mode. Add your Gemini API key to .env to enable real AI responses. For now, I can tell you that the crypto market is always exciting! 🚀",
      _mock: true
    });
  }

  try {
    const { messages, context } = req.body;
    const systemPrompt = `You are FinPulse AI — an expert crypto market analyst and research assistant. You have access to real-time data from SoSoValue platform including:
- Cryptocurrency prices, market caps, and trading volumes
- Bitcoin & Ethereum ETF flows and performance
- SoSoValue Index (SSI) data
- BTC Treasury holdings by public companies
- Macro economic events and their impact on crypto
- Latest crypto news and market sentiment
- Fundraising/investment data for crypto projects

Current market context provided:
${context || 'No specific context available.'}

Rules:
1. Be concise but insightful
2. Always reference specific data points when available
3. Use emojis sparingly for readability
4. Flag risks and opportunities
5. Never give direct financial advice, but provide analysis
6. Format responses with markdown for readability`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am FinPulse AI, ready to analyze crypto markets.' }] },
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    const data = await response.json();
    
    if (!data.candidates) {
      console.error('Gemini API Error:', JSON.stringify(data, null, 2));
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response. Please check the server logs for API errors.';
    res.json({ response: text });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    res.json({ response: 'AI service temporarily unavailable. Please try again later.', error: true });
  }
});

// Route all /api/soso/* requests to SoSoValue
app.use('/api/soso', (req, res) => {
  proxyToSoSoValue(req, res);
});

app.listen(PORT, () => {
  console.log(`\n🚀 FinPulse API Proxy running on http://localhost:${PORT}`);
  console.log(`   SoSoValue API Key: ${process.env.VITE_SOSOVALUE_API_KEY ? '✅ Configured' : '❌ Not set (demo mode)'}`);
  console.log(`   Gemini API Key: ${process.env.VITE_GEMINI_API_KEY ? '✅ Configured' : '❌ Not set (demo mode)'}\n`);
});
