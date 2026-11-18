### What changed since the Wave 3 review

SoSoValue (research) → **FinPulse (decision + risk)** → SoDEX (execution) → graded track record.

Each point answers one judge comment.

**1. SoDEX execution (was: none)**
Real, signed spot orders on SoDEX testnet, placed from the app.
- One wallet signature registers a session key (EIP-712 addAPIKey). Keys never leave the browser.
- Each order is a batchNewOrder (IOC limit, 0.5% from mid), signed by the session key and relayed to SoDEX.
- Before signing, the server prices the order on the live SoDEX book and blocks it if slippage > 0.5%, spread > 1%, or the book is empty or one-sided.

Verified orders on vBTC_vUSDC. Each one filled within 0.011% of the price the ticket previewed:

| Order ID | Expected | Filled |
|---|---|---|
| 1305574701 | 64 712 | 64 712 |
| 1305601780 (live demo) | 64 362 | 64 369 |
| 1305606306 (live demo) | 64 256 | 64 259 |
| 1305610534 (live demo) | 64 218 | 64 212 |

**2. Live demo (was: video only)**
https://35-192-142-253.sslip.io: one Node service behind HTTPS, with a persistent signal ledger and execution log.

**3. Mock vs live data (was: mixed silently)**
Every widget is labelled LIVE / CACHED / STALE / SIMULATED. We audited all modules and replaced every hardcoded or random number:
- $0 market cap
- random Fear & Greed
- hardcoded "alpha vs MAG7"
- a random BTC price in Treasury
- invented macro impacts
- a broken ETF request that was falling back to mock data

**4. Methodology and validated signals (was: none)**
The FinPulse Score (−100…+100) combines 6 volatility-normalised components with published weights: ETF flow 25, momentum 25, trend 15, volume 10, sector 10, news 15.
- Confidence = coverage × agreement × macro haircut.
- A walk-forward backtest is compared with a naive strategy that has the same long/short mix. The window rolls daily. As of 18 Nov the edge is +0.4 pp (1d), +3.9 pp (3d) and +6.8 pp (7d): close to zero at one day, positive at 3–7 days. The current figures and the limits are on Signal Desk → Track record.
- A forward-test ledger has been live since 17 Nov 2026 and grades every signal at 24h, 72h and 7 days.

**5. Execution log**
Signal Desk → Executions shows each order as signal → expected fill → order ID → actual SoDEX fills → mark-to-market.

**6. AI Analyst**
Grounded in the live scores, backtest edge and ledger; quotes the edge, not the raw hit rate.

**Verify it yourself (no login)**
- Open the live demo → Signal Desk → Executions: the chain for each order.
- Raw JSON (the order fills are read back from SoDEX):
  - https://35-192-142-253.sslip.io/api/sodex/executions
  - https://35-192-142-253.sslip.io/api/ledger

Links
- Live demo: https://35-192-142-253.sslip.io
- GitHub: https://github.com/Hort1934/FinPulse-Agent
- Demo video: VIDEO_URL
