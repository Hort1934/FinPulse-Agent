<div align="center">

# FinPulse Agent

### A signal desk that turns SoSoValue data into a scored, tracked, executable trade on SoDEX

[![SoSoValue](https://img.shields.io/badge/Data-SoSoValue%20OpenAPI-00d4ff?style=for-the-badge)](https://sosovalue.com)
[![SoDEX](https://img.shields.io/badge/Execution-SoDEX%20testnet-a855f7?style=for-the-badge)](https://testnet.sodex.dev)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev)

**Signal → risk check → wallet signature → SoDEX fill → graded track record**

</div>

---

## What it does

FinPulse reads market, ETF, sector, news and macro data from the SoSoValue OpenAPI and scores five assets (BTC, ETH, SOL, XRP, BNB). Each score is built from published components.

When a score crosses the threshold, the desk prices the trade against the live SoDEX order book. It runs risk checks and lets you sign and send a real spot order from your own wallet. Every order is logged with its expected and actual fill, and every signal is recorded so it can be graded later.

Nothing on screen is invented. Every widget reports where its numbers came from (**LIVE / CACHED / STALE / SIMULATED**), and the header badge summarises the page.

| | |
|---|---|
| **Signal** | FinPulse Score −100…+100 from 6 components, with a confidence value and a per-component breakdown |
| **Validation** | Walk-forward backtest compared with a naive baseline, plus a forward-test ledger graded at 24h / 72h / 7d |
| **Execution** | EIP-712 signed spot orders on SoDEX testnet, sent through a short-lived session key. One wallet signature enables trading |
| **Accountability** | Execution log: signal → ticket → signature → SoDEX order ID → fills → mark-to-market |
| **Analyst** | Gemini chat that receives the scores, the backtest edge and the ledger, and is told to quote the edge, not the raw hit rate |

> **Live demo:** link added after deployment. Until then, see [Run it locally](#run-it-locally).

---

## Wave 3 → Wave 4: what changed

These changes respond directly to the judges' Wave 3 feedback.

| Wave 3 feedback | Before | Now |
|---|---|---|
| **No SoDEX execution** | A "Trade" button that opened a mock modal | Real signed spot orders on SoDEX testnet. The first order was **BUY 0.0003 vBTC, IOC limit 65 036**, order ID **`1305574701`**, filled at **64 712**, exactly the price the preview predicted (0.00% slippage against the preview) |
| **Mock data not separated from live** | Mock fallback rendered silently, looking like real data. Several widgets used `Math.random()` or hardcoded numbers | Each response carries provenance metadata. Fallback data is labelled **SIMULATED**, and the header badge shows the worst source on the page. Every hardcoded or random metric has been removed (details below) |
| **No distinct methodology / validated signals** | "Auto-generated signals" from one-day price change | **FinPulse Score**: 6 weighted, volatility-normalised components, confidence = coverage × agreement × macro haircut, a walk-forward backtest with a **naive baseline and edge**, and a forward ledger |
| **Wave description too high level** | Feature list | This table, the methodology below, and verifiable order IDs |
| **No live demo** | Video only | Deployment in progress (single Node process serves API + UI) |

### Data audit: every module, what was fake and what replaced it

| Module | Was | Now |
|---|---|---|
| Market Pulse | Total market cap showed **$0**. Fear & Greed was a random number | Total cap = BTC market cap ÷ BTC dominance (SoSoValue sector data). The gauge is the average FinPulse Score |
| Portfolio | "Alpha +1.2% vs SSI MAG7" was **hardcoded text**, and the holdings were fixed | Editable holdings, one-click **import from your SoDEX balances**, real 24h / 7d / 1m benchmark against the ssiMAG7 snapshot |
| BTC Treasury | Wrong BTC id, so the USD values came from a **random mock price** or a fixed $90 000 | Live BTC price and circulating supply, 30-day change per company, last purchase with implied average price |
| Macro Radar | Every event was set to "medium", with made-up country and category. The default view was **empty** | Impact classified by published rules (shared with the score engine). Next high-impact event highlighted |
| Index & ETF | Totals covered 5 ETFs, the change column was always 0.00%, and the flow-history call was missing a required parameter (so it **silently fell back to mock data**) | Totals across all US spot ETFs (BTC / ETH / SOL / XRP), daily net-flow chart, per-ETF value traded and fee. Index ROI over 24h / 7d / 1m / 3m / YTD / 1y |
| News Intel | Substring keyword match ("high" matched "highlight"), raw JSON in tickers, NaN% on empty feeds, "AI-powered" label | Whole-word lexicon shared with the score, deduplication, readable tickers, honest label |
| AI Analyst | Claimed signals were "strongly predictive" by comparing with the raw up-rate | Receives naive hit rate and edge, and reports e.g. "+6.0 pp over a random strategy with the same long/short mix" |

---

## Methodology: the FinPulse Score

Each component is mapped to **[−1, +1]** with `tanh` after volatility normalisation, so one large move cannot dominate the score.

| Component | Weight | Input (SoSoValue) | Formula |
|---|---|---|---|
| ETF flow | 25 | ETF summary history | `tanh(avg 5d net flow / σ daily flow)` |
| Momentum | 25 | Daily klines | `tanh(t / 1.5)`, with `t = 0.2·r1/σ + 0.4·r7/(σ√7) + 0.4·r30/(σ√30)` |
| Trend | 15 | Daily klines | `tanh((SMA20/SMA50 − 1) / 1.5σ)` |
| Participation | 10 | Daily volume | `sign(day) · tanh(ln(volume / 20d avg))` |
| Sector | 10 | Sector spotlight | `tanh(sector 24h % / 3)` |
| News tone | 15 | News feed | Whole-word bullish vs bearish terms in articles that mention the asset |

- **Score** = weighted mean × 100 over the components available. If a source is missing, its weight is redistributed and *coverage* drops.
- **Stance**: score ≥ +25 → **ACCUMULATE**, ≤ −25 → **REDUCE**, otherwise **NEUTRAL**.
- **Confidence** = `coverage × (0.5 + 0.5 × agreement) × macro factor`.
  - *Agreement* is the share of components that point the same way as the score.
  - *Macro factor* is 0.75 when a high-impact event (CPI, PCE, FOMC, payrolls, GDP) is ≤ 1 day away, 0.9 at medium risk, and 1 otherwise.
- Asset universe: BTC, ETH, SOL, XRP, BNB. ETF flows are used where a US spot ETF exists.

### Validation

**Walk-forward backtest** (daily candles, 2026-10-09 → 2026-11-15). Each day is scored using only the data available up to that day.

Sector and news have no history in the API, so the backtest uses ETF flow, momentum, trend and participation.

| Horizon | Signals | Hit rate | Naive baseline* | **Edge** | Avg signed return |
|---|---|---|---|---|---|
| 1 day | 108 | 58.3% | 54.7% | **+3.6 pp** | +1.0% |
| 3 days | 98 | 78.6% | 72.6% | **+6.0 pp** | +3.5% |
| 7 days | 78 | 85.9% | 79.7% | **+6.2 pp** | +6.7% |

\* *Naive baseline* is a random strategy with the same long/short mix in the same market. The period was mostly a falling market (98 of 108 one-day signals were shorts), so the raw hit rate overstates skill. **The edge is the number that matters.**

**Limitations, stated plainly**

- The sample is small.
- Windows overlap, so the samples are not independent.
- The test covers a single market regime.
- These figures are a sanity check, not proof of alpha.

**Forward-test ledger.** Since the server started, each live signal is stored when it is issued. A new entry is written per asset every 6 hours, or immediately when the stance flips. Each entry is then graded against the real price 24h, 72h and 7 days later.

The Signal Desk → **Track record** tab, the `/api/ledger` endpoint and the Telegram `/track` command all show the graded results. The ledger cannot be backfilled, so its results build up from the moment of deployment.

---

## Execution on SoDEX

```
Signal Desk ──▶ Trade ticket ──▶ Risk checks ──▶ Wallet signs ──▶ SoDEX ──▶ Execution log
   score         live orderbook    slippage ≤ 0.5%    EIP-712         order ID     fills, slippage
   stance        avg fill price    size ≤ 25% bal.    session key     IOC limit    mark-to-market
                                   spread ≤ 1%
```

1. **Enable trading (once).** The browser generates a session key, and your wallet signs one `addAPIKey` action (EIP-712, `universal` domain).

   The key is registered on SoDEX spot and perps and stored only in your browser. No private key ever reaches the server, and MetaMask does not need the ValueChain network for this step.

2. **Ticket.** The server walks the live SoDEX order book and computes the expected average fill, slippage, spread and size against your balance.

   An empty or one-sided book is **blocked** with a liquidity message instead of being priced as zero.

3. **Sign and send.** The order is a `batchNewOrder` (IOC limit, 0.5% from mid). The session key signs it (EIP-712 `spot` domain). The server rebuilds the payload canonically and relays it to `POST /spot/trade/orders/batch`.

   If the price is older than 20 seconds, the ticket must be re-priced before it can be sent.

4. **Log.** Each order is stored with its signal, expected price and order ID. On every view, the log is enriched with the actual SoDEX fills, the slippage against the preview, and unrealised P&L at the current mark.

**Verified testnet order**

| Field | Value |
|---|---|
| Wallet | `0x8035D09f95Fd6B76a953b0f259c00f98f7694Ef1` |
| Market | `vBTC_vUSDC` (SoDEX testnet, ValueChain chainId 138565) |
| Signal at order time | BTC score −50, REDUCE (spot account held no vBTC, so the ticket defaulted to Buy) |
| Order | BUY 0.0003 · IOC limit 65 036 |
| Order ID | **1305574701** |
| Expected / actual fill | 64 712 / **64 712** |

> Testnet note: only `vBTC_vUSDC` currently has a two-sided book on SoDEX testnet. For the other markets, the ticket shows the liquidity block instead of a misleading price.

---

## Product tour

| Section | What you get |
|---|---|
| **Signal Desk** | Score cards with component bars and the plain-language reasons; Methodology; Track record (backtest + ledger); Executions; Fundraising |
| **AI Analyst** | Gemini chat grounded in the current scores, backtest edge, ledger and macro calendar; shows the time of the data it used |
| **Market Pulse** | Total crypto market cap, BTC/ETH dominance, stablecoin share, sector heatmap, desk brief |
| **Portfolio** | Holdings imported from SoDEX, P&L, alpha vs SSI MAG7 |
| **Index & ETF** | SSI indices ROI, US spot ETF flows for BTC / ETH / SOL / XRP |
| **BTC Treasury** | Corporate holdings, % of supply, 30-day change, last purchase |
| **Macro Radar** | Economic calendar with impact rules shared with the score engine |
| **News Intel** | Deduplicated SoSoValue feed with tone and trending tags |
| **Telegram bot** *(optional)* | `/signals`, `/score BTC`, `/track`, or a free-form question |

---

## Architecture

```
React 19 + Vite ─── /api ───▶ Express 5 (server/index.js)
  │                              ├─ lib/sosovalue.js   rate-limited queue (≤100 req/min), TTL cache,
  │                              │                     in-flight dedupe, provenance (live/cache/stale)
  │                              ├─ lib/score.js       FinPulse Score, confidence, walk-forward backtest
  │                              ├─ lib/ledger.js      forward-test ledger (server/data/ledger.json)
  │                              ├─ lib/sodex.js       orderbook pricing, risk checks, order relay, fills
  │                              ├─ lib/executions.js  execution log (server/data/executions.json)
  │                              └─ lib/gemini.js      Gemini with model fallback
  │
  ├─ services/sodexSigner.js  session key + EIP-712 signing in the browser (viem)
  ├─ services/provenance.js   per-widget source tracking → header badge
  └─ shared/lexicon.js        news tone + macro impact rules, used by server and client
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/signals` | Scores, components, confidence, macro risk, backtest, data sources |
| `GET /api/ledger` | Forward-test ledger with graded outcomes |
| `GET /api/sodex/preview?symbol&side&usd&address` | Order-book pricing and risk checks |
| `GET /api/sodex/account/:address` | SoDEX account ID and balances |
| `POST /api/sodex/exchange/:engine` | Relay a signed `addAPIKey` (only this action is accepted) |
| `POST /api/sodex/orders` | Relay a signed spot order; recorded in the execution log |
| `GET /api/sodex/executions?address` | Execution log enriched with fills and mark-to-market |
| `POST /api/ai/chat` | AI Analyst |
| `GET /api/soso/*` | Cached SoSoValue proxy with provenance metadata |

---

## Run it locally

Requirements: Node.js 20+, a SoSoValue API key, a Gemini API key. For trading you also need MetaMask with SoDEX testnet funds.

```bash
git clone https://github.com/Hort1934/FinPulse-Agent.git
```

```bash
cd FinPulse-Agent && npm install && cp .env.example .env
```

Fill in `.env`:

```env
VITE_SOSOVALUE_API_KEY=...   # https://sosovalue.com → API
VITE_GEMINI_API_KEY=...      # https://aistudio.google.com
SODEX_NETWORK=testnet
PORT=3001
# optional
GEMINI_MODEL=                # default gemini-3.8-flash
TELEGRAM_BOT_TOKEN=
```

Start the API server and the UI in two terminals:

```bash
npm run server
```

```bash
npm run dev
```

Open http://localhost:5173.

Without API keys the dashboard still runs. Widgets fall back to sample data and are labelled **SIMULATED**.

---

<div align="center">

Built for the **SoSoValue Buildathon** · data by SoSoValue · execution on SoDEX

</div>
