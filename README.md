<div align="center">

# 🧠 FinPulse Agent

### AI-Powered Crypto Market Intelligence Command Center

*Your one-person crypto research desk — powered by SoSoValue API*

[![SoSoValue](https://img.shields.io/badge/Powered%20by-SoSoValue-00d4ff?style=for-the-badge)](https://sosovalue.xyz)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev)

</div>

---

## 🚀 What is FinPulse Agent?

FinPulse Agent is a **Bloomberg-terminal-inspired AI command center** that transforms raw SoSoValue data into actionable intelligence. It combines a cinematic dark-theme dashboard with an embedded AI agent that can reason about cross-asset correlations, news sentiment, ETF flows, BTC treasury movements, and macro events — all in a single unified view.

**Users don't just _see_ data — they _converse_ with it.**

## ✨ Features

### ⚡ Market Pulse Dashboard
- Live price ticker strip (BTC, ETH, SOL, etc.)
- Fear & Greed gauge with dynamic visualization
- Sector heatmap with real-time percentage changes
- Top assets leaderboard by market cap

### 📰 News Intelligence Center
- Real-time news feed from SoSoValue
- AI-powered sentiment analysis (bullish/bearish/neutral)
- Category filtering (News, Research, Institutional, Insights)
- Trending topics tag cloud
- Sentiment distribution visualization

### 📊 Index & ETF Analytics Hub
- SSI Index tracker with TradingView-quality interactive charts
- ETF flow visualizer (net inflows/outflows)
- Index constituent breakdown (pie chart)
- Comparative ETF performance analysis

### 🏦 BTC Treasury Monitor
- Corporate BTC holdings leaderboard
- Visual holdings distribution bar
- Supply percentage tracking
- Purchase history timeline

### 🌍 Macro Event Radar
- Economic calendar with impact filtering
- Event countdown timers
- Impact classification (High/Medium/Low)
- Previous vs Forecast comparison

### 🔍 Opportunity Discovery Engine
- Auto-generated trading signals
- Volume spike detection
- Momentum analysis
- Recent fundraising rounds tracker

### 🤖 AI Agent Chat (Killer Feature)
- Natural language market analysis
- Context-aware responses using live market data
- Pre-built query suggestions
- Powered by Google Gemini (free tier)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 |
| Styling | Vanilla CSS (custom design system) |
| Charts | TradingView Lightweight Charts v5 |
| Backend | Express.js (API proxy) |
| AI | Google Gemini API (free tier) |
| Data | SoSoValue API |

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/FinPulse-Agent.git
cd FinPulse-Agent

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configuration

Edit `.env` with your API keys:

```env
# SoSoValue API Key (get from https://sosovalue.xyz → API docs)
VITE_SOSOVALUE_API_KEY=your_key_here

# Google Gemini API Key (get from https://aistudio.google.com)
VITE_GEMINI_API_KEY=your_key_here
```

> **Note:** The app works in **demo mode** without API keys, using realistic mock data.

### Running

```bash
# Terminal 1: Start the API proxy server
npm run server

# Terminal 2: Start the frontend dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
npm run build
```

## 🏗️ Architecture

```
FinPulse-Agent/
├── server/
│   └── index.js          # Express.js API proxy + Gemini AI endpoint
├── src/
│   ├── components/
│   │   ├── MarketPulse.jsx      # Market overview dashboard
│   │   ├── NewsIntel.jsx        # News feed + sentiment analysis
│   │   ├── IndexHub.jsx         # SSI Index + ETF analytics
│   │   ├── TreasuryMonitor.jsx  # Corporate BTC holdings
│   │   ├── MacroRadar.jsx       # Economic events calendar
│   │   ├── OpportunityEngine.jsx# Signal generation
│   │   └── AgentChat.jsx        # AI chatbot interface
│   ├── services/
│   │   ├── api.js               # SoSoValue API client
│   │   └── mockData.js          # Demo mode mock data
│   ├── App.jsx                  # Main layout + routing
│   ├── main.jsx                 # React entry point
│   └── index.css                # Complete design system
├── .env.example                 # Environment variables template
├── package.json
└── vite.config.js               # Vite + proxy configuration
```

## 🔑 API Integration

FinPulse Agent integrates with **all 9 SoSoValue API modules**:

| Module | Endpoints Used |
|--------|---------------|
| Currency | Market snapshots, klines, token economics, sector spotlight |
| ETF | ETF list, summary history, market snapshots |
| Index | Index list, constituents, klines |
| BTC Treasuries | Holdings leaderboard, purchase history |
| News | Real-time feed, hot news, featured news |
| Fundraising | Project funding rounds |
| Macro | Economic events, event history |
| Crypto Stocks | Stock data |
| Analysis | Chart data |

## 💡 How the AI Agent Works

1. **User asks a question** in natural language
2. **Intent recognition** parses the query to determine context
3. **Market context injection** — current prices, sentiment, and key metrics are provided
4. **Gemini AI** generates an insightful, data-driven response
5. **Response rendering** with markdown formatting

Example queries:
- *"What's the current market sentiment?"*
- *"Which sectors are pumping today?"*
- *"Analyze BTC ETF flows this week"*
- *"What macro events should I watch?"*

## 🎨 Design Philosophy

- **Bloomberg-inspired dark theme** with cyan accents
- **Glassmorphism** cards with subtle glow effects
- **Micro-animations** for engagement (pulse dots, fade-ins, hover effects)
- **Professional typography** (Inter + JetBrains Mono)
- **Responsive design** — works on desktop and mobile

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the SoSoValue Buildathon 2025**

*Making the "one-person business empire" vision possible.*

</div>
