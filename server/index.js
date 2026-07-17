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

// ==========================================
// TELEGRAM BOT INTEGRATION
// ==========================================
import TelegramBot from 'node-telegram-bot-api';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (TELEGRAM_TOKEN) {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log(`🤖 Telegram Bot is running...`);

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to FinPulse AI Bot! 🚀\nI am your proactive crypto market analyst.\n\nYou can ask me things like:\n"What is the current market sentiment?"\n"Are ETFs buying BTC right now?"');
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands like /start
    if (text.startsWith('/')) return;

    bot.sendChatAction(chatId, 'typing');

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      bot.sendMessage(chatId, "⚠️ My AI brain is currently in demo mode (no API key configured). Please add VITE_GEMINI_API_KEY to your .env file!");
      return;
    }

    try {
      const systemPrompt = `You are FinPulse AI, an elite crypto market analyst responding via Telegram. Keep responses to 1-3 complete sentences. Be punchy, conversational, and use emojis. Do NOT cut off sentences abruptly. Format as plain text with standard emojis (avoid complex markdown formatting that might break). Context: User asked: "${text}"`;
      
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      });

      const data = await response.json();
      let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I encountered an error analyzing the market.';
      
      // Clean up any unclosed markdown or problematic characters for Telegram
      reply = reply.replace(/[*_`]/g, '');

      bot.sendMessage(chatId, reply);
    } catch (e) {
      console.error(e);
      bot.sendMessage(chatId, 'Sorry, I am having trouble connecting to my neural network right now. 📉');
    }
  });
}
