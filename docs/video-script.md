# Demo video script (about 3 minutes)

The voiceover is in English. Each scene lists **what to show** and **what to say**.
The order follows the judging criteria: practical value → working demo → logic → data → UX.

## Before recording

1. **Update the VM** so the Executions fix is live:
   `sudo bash /opt/finpulse/app/deploy/update.sh`
2. **Warm the cache.** Open https://35-192-142-253.sslip.io and click through Signal Desk and AI Analyst once, 2–3 minutes before you start. The first score calculation and the first AI answer take about 20 seconds.
3. **Prepare the browser and wallet:**
   - One tab: the live site at 100% zoom, 1920×1080.
   - Close other tabs. Collapse or close the MetaMask side panel while you are not signing.
   - MetaMask: Account 1, trading already enabled on this site. You have about 60 vUSDC.
4. **Order size.** For the order, use **$10**. That is at least 5 vUSDC and under 25% of the balance, so the ticket shows no size warning.
5. **Record.** Use OBS or Win+Alt+R, 1080p. Record the voice separately or over the video. Cut out any waits longer than 2 seconds.

---

## 0:00–0:15 · Hook

**Show:** Market Pulse, with the address bar showing `35-192-142-253.sslip.io`.

> "FinPulse is a one-person trading desk on SoSoValue and SoDEX. It turns market data into a scored signal, checks the trade against the real order book, lets you sign it from your wallet, and then keeps score of whether it was right. Everything you'll see is live."

## 0:15–0:35 · Data honesty

**Show:** point at the **LIVE** badge in the header, then click it to open the list of sources.

> "Every number on screen comes from the SoSoValue API, and every widget says whether it is live, cached or simulated. No placeholder numbers. If a source fails, you see a dash, not a guess."

## 0:35–1:15 · The signal (Signal Desk → Scores)

**Show:**
1. The BTC card. Move the cursor over the component bars: ETF flow, momentum, trend.
2. Open **"How the FinPulse Score works"** for 2 seconds.

> "Each asset gets a FinPulse Score from minus 100 to plus 100, built from six components: US spot ETF flows, momentum, trend, volume, sector and news. Each one has a published weight. Right now BTC is at minus 48: five days of ETF outflows, a down-trend, negative momentum. That's a REDUCE.
> Confidence is separate. It drops when data is missing, when components disagree, or when a major macro event like CPI or FOMC is a day away."

## 1:15–1:40 · Is the signal any good? (Track record)

**Show:** the **Track record** tab. Point at the **Edge** column, then at the ledger.

> "Does it work? We ran a walk-forward backtest, where each day only sees the data available on that day. We compare it with a random strategy that has the same mix of longs and shorts. The edge is plus 3.6 points at one day and about plus 6 points at three and seven days. It's modest, and we say so. The raw hit rate looks higher only because the market fell.
> On the live server, every signal is also logged and graded at 24 hours, 3 days and 7 days, so the track record builds itself."

## 1:40–2:00 · Risk checks that say no (BNB)

**Show:** open the ticket for **BNB** → Price & risk-check. The red block appears: spread 53%, slippage 26%.

> "Before any trade, FinPulse walks the live SoDEX order book. On BNB the testnet book has a 53% spread, so the order is blocked with the reason. SOL and XRP books are empty, and those are blocked too."

## 2:00–2:40 · A real order (BTC)

**Show:**
1. Open the ticket for **BTC** → Buy → **$10** → **Price & risk-check order**. Pause on the green checks and on "Order to sign".
2. Click send. MetaMask is not needed here because the session key signs. Wait for "Order accepted" with the order ID.

> "On BTC the book is healthy. The ticket shows the expected fill, the slippage, and the exact order I'm about to sign: an immediate-or-cancel limit, half a percent from mid, so the exchange can never fill me worse than that.
> Trading was enabled once with a single wallet signature that registered a session key. The key stays in my browser. Sign, send, and SoDEX accepts it. Here's the order ID."

## 2:40–3:00 · Accountability (Executions)

**Show:** the **Executions** tab. Walk the cursor along the new card: Signal → Risk check → Signed order → SoDEX → Fill → Now.

> "And this is the part a trader actually needs: the full chain. The signal that was on screen, the expected fill, the order ID, the actual fill read back from SoDEX, the slippage against the preview, and the position marked to market now. Our last fill came in within one hundredth of a percent of the preview."

## 3:00–3:20 · AI Analyst

**Show:** AI Analyst. Type: **"Should I trust the BTC signal right now?"** Cut out the wait, then show the answer.

> "The AI analyst sees the same scores, the backtest edge and the ledger. It's told to quote the edge, not the raw hit rate, and it names the data time it used."

## 3:20–3:35 · Quick tour and close

**Show:** quick cuts of about 2 seconds each: Index & ETF (flow chart), BTC Treasury, Macro Radar, then back to Signal Desk.

> "Around it: ETF flows, SSI indices, BTC treasuries and the macro calendar, all from SoSoValue.
> FinPulse: signal, risk check, signature, fill, track record. Live demo and code are in the description."

---

## YouTube description

```
FinPulse Agent: SoSoValue data → FinPulse Score → risk-checked SoDEX order → graded track record.

Live demo: https://35-192-142-253.sslip.io
Code, methodology and validation: https://github.com/Hort1934/FinPulse-Agent

0:00 What it is
0:15 Live data, labelled
0:35 FinPulse Score
1:15 Backtest edge and forward ledger
1:40 Risk checks blocking bad books
2:00 Real SoDEX testnet order
2:40 Execution log: signal to fill
3:00 AI Analyst
```

Set the visibility to **Public** or **Unlisted**, so the link opens for anyone. Akindo needs a public YouTube URL.
