### What changed since the Wave 3 review

Each point answers one judge comment. Everything below can be checked on the live demo or in the repo.

**1. SoDEX execution (was: none)**
Real, signed spot orders on SoDEX testnet, placed from the app.
- One wallet signature registers a session key (EIP-712 addAPIKey). Keys never leave the browser.
- Each order is a batchNewOrder (IOC limit, 0.5% from mid), signed by the session key and relayed to SoDEX.
- Before signing, the server prices the order on the live SoDEX book and blocks it if slippage > 0.5%, spread > 1%, or the book is empty or one-sided.

Verified orders on vBTC_vUSDC:
- 1305574701: expected 64 712, filled 64 712
- 1305601780 (from the live demo): expected 64 362, filled 64 369 (+0.011%)

**2. Live demo (was: video only)**
https://35-192-142-253.sslip.io is a single Node service behind HTTPS, with persistent storage for the signal ledger and the execution log.

**3. Mock vs live data (was: mixed silently)**
Every widget is labelled LIVE / CACHED / STALE / SIMULATED, and a header badge shows the worst state on the page. We audited all modules and replaced every hardcoded or random number:
- $0 market cap
- random Fear & Greed
- hardcoded "alpha vs MAG7"
- a random BTC price in Treasury
- invented macro impacts
- a broken ETF request that was falling back to mock data

**4. Methodology and validated signals (was: none)**
The FinPulse Score (−100…+100) combines 6 volatility-normalised components with published weights: ETF flow 25, momentum 25, trend 15, volume 10, sector 10, news 15.
- Confidence = coverage × agreement × macro haircut.
- A walk-forward backtest is compared with a naive strategy that has the same long/short mix. Edge: +3.6 pp (1d), +6.0 pp (3d), +6.2 pp (7d). The limits are stated.
- A forward-test ledger has been live since 17 Nov 2026 and grades every signal at 24h, 72h and 7 days.

**5. Execution log**
Signal Desk → Executions shows each order as signal → expected fill → order ID → actual SoDEX fills → mark-to-market.

**6. AI Analyst**
Grounded in the live scores, backtest edge and ledger, and told to quote the edge rather than the raw hit rate.

Links
- Live demo: https://35-192-142-253.sslip.io
- GitHub (methodology, API, changelog): https://github.com/Hort1934/FinPulse-Agent
- Demo video: VIDEO_URL
