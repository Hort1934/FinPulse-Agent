# Akindo submission: FinPulse Agent (Wave 4)

Paste-ready text. Each `##` section below maps to one Akindo field.

---

## Tagline

A signal desk that turns SoSoValue data into a scored, risk-checked, wallet-signed trade on SoDEX, with a public track record.

## Links

- Live demo: https://35-192-142-253.sslip.io
- GitHub: https://github.com/Hort1934/FinPulse-Agent
- Methodology and validation: README → "Methodology" and "Validation"

## Product description

FinPulse Agent is a decision-and-execution desk for crypto, built on the SoSoValue OpenAPI and SoDEX. It scores BTC, ETH, SOL, XRP and BNB.

**Score.** The FinPulse Score (−100…+100) is built from six components:
- US spot ETF net flows
- volatility-adjusted momentum
- trend (SMA20 vs SMA50)
- volume participation
- sector performance
- news tone

Each component is normalised to [−1, +1] and given a published weight. Above +25 the stance is ACCUMULATE, below −25 it is REDUCE.

**Confidence.** Confidence = data coverage × how many components agree × a haircut when a high-impact macro event (CPI, PCE, FOMC, payrolls) is a day or less away.

**Trading.** From any signal the user opens a SoDEX trade ticket:
1. The server walks the live SoDEX order book to price the fill and slippage.
2. It runs risk checks: slippage ≤ 0.5%, spread ≤ 1%, size against balance, liquidity, and whether the trade goes against the signal.
3. If the checks pass, the order is signed in the browser with EIP-712 and sent to SoDEX.

Private keys never leave the browser. Enabling trading takes one wallet signature, which registers a session key.

**Accountability.** Every order is logged as signal → risk check → signed order → SoDEX order ID → actual fills → mark-to-market. Every signal is stored and graded at 24h, 72h and 7 days.

Every widget shows whether its data is LIVE, CACHED, STALE or SIMULATED. Nothing on screen is invented.

An AI Analyst (Gemini) answers questions using the current scores, the backtest edge and the ledger, and has to quote the edge rather than raw hit rates. A Telegram bot exposes `/signals`, `/score BTC` and `/track`.

## Wave 4 update: what we changed, mapped to the Wave 3 reviews

**1. "No SoDEX execution"**

Real, signed spot orders on SoDEX testnet, placed from the app:

- **Session key:** a one-time `addAPIKey` signature (EIP-712, universal domain).
- **Signed order:** `batchNewOrder`, IOC limit at 0.5% from mid, signed with the session key.
- **Relay:** the server rebuilds the payload canonically and relays it.

Two verified orders on `vBTC_vUSDC`:

| Order ID | Order | Fill | Expected by preview |
|---|---|---|---|
| 1305574701 | BUY 0.0003 | 64 712 | 64 712 (0.00% deviation) |
| 1305601780 | BUY 0.00031 (placed from the live demo) | 64 369 | 64 362 (+0.011%) |

When a market cannot be traded, the ticket blocks the order and explains why. On testnet today:
- SOL and XRP have empty order books;
- ETH has no asks;
- BNB has a 53% spread.

**2. "No live demo"**

The app is deployed at https://35-192-142-253.sslip.io. One Node process serves the API and the UI behind HTTPS, with persistent storage for the signal ledger and the execution log.

**3. "Mock data not separated from live data"**

- Every API response carries provenance (live / cache / stale), and any fallback is labelled SIMULATED. A header badge shows the worst data state on the page.
- We audited every module and removed all hardcoded and random numbers:
  - Market Pulse: total market cap showed $0 and Fear & Greed was a random number.
  - Portfolio: the "alpha vs MAG7" line was hardcoded text.
  - BTC Treasury: USD values were computed from a random mock price.
  - Macro: impact levels were invented.
  - ETF: a malformed request was silently falling back to mock data.
  - News: substring keyword matching.
- Every one of these now comes from SoSoValue. If the data cannot be loaded, the widget shows "—".

**4. "No distinct methodology or validated signals"**

- **Methodology.** The FinPulse Score formula, weights, threshold and confidence model are published in the app and in the README.
- **Walk-forward backtest.** Each day is scored only with data available on that day. Results are compared with a naive strategy that has the same long/short mix in the same market. Snapshot from 17 Nov 2026; the window rolls daily, and the current figures are on Signal Desk → Track record:

  | Horizon | Hit rate | Naive strategy | Edge |
  |---|---|---|---|
  | 1 day | 58.3% | 54.7% | **+3.6 pp** |
  | 3 days | 78.6% | 72.6% | **+6.0 pp** |
  | 7 days | 85.9% | 79.7% | **+6.2 pp** |

  We report the edge, not the raw hit rate, because the test window was mostly a falling market. We also state the limits: a small sample, overlapping windows, and a single market regime.
- **Forward test.** A ledger has been running on the live server since 17 Nov 2026. It records every signal at issue time and grades it at 24h, 72h and 7 days. Results are visible in Signal Desk → Track record.

**5. "Wave description too high level"**

The README now has a was → now changelog for every module, the full formulas, the API list, and order IDs that anyone can check on SoDEX testnet.

## How it uses SoSoValue and SoDEX

**SoSoValue OpenAPI**
- Currency snapshots and klines, sector spotlight
- US spot ETF summary history for BTC / ETH / SOL / XRP, ETF list
- SSI indices
- BTC treasuries and purchase history
- News feed, macro calendar, fundraising

All calls go through a server-side queue that stays under 100 requests per minute, with caching and deduplication.

**SoDEX (testnet)**
- Market symbols, order books and tickers
- Account balances, orders and trades
- API key registration
- Signed spot orders

## What's next

- Grade the forward ledger as it matures and publish the 7-day results.
- Add perps, which make REDUCE signals actionable as shorts.
- Size positions by confidence.
- Run the same flow on SoDEX mainnet once liquidity allows.
