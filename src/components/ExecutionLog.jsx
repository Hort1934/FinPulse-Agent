import { useEffect, useState, useCallback } from 'react'
import { getExecutions } from '../services/api'

const SIDE = { 1: 'BUY', 2: 'SELL' }
const TIF = { 1: 'GTC', 2: 'FOK', 3: 'IOC', 4: 'GTX' }
const EXPLORER = 'https://testnet.sodex.com'

const num = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }))
const signedPct = (x, d = 3) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(d)}%`)

function Step({ label, children, tone }) {
  return (
    <div className={`xl-step ${tone || ''}`}>
      <div className="xl-step-label">{label}</div>
      <div className="xl-step-body">{children}</div>
    </div>
  )
}

function ExecutionCard({ e }) {
  const side = SIDE[e.order.side]
  const against = e.signal && ((side === 'BUY' && e.signal.stance === 'REDUCE') || (side === 'SELL' && e.signal.stance === 'ACCUMULATE'))
  const filled = e.filledQty > 0
  return (
    <div className="xl-card fade-in">
      <div className="xl-head">
        <div>
          <b>{e.symbol}</b> <span className={`badge ${side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{side}</span>
        </div>
        <span className="muted">{new Date(e.ts).toLocaleString()}</span>
      </div>

      <div className="xl-chain">
        <Step label="1 · Signal" tone={against ? 'warn' : 'ok'}>
          {e.signal ? <>FinPulse <b>{e.signal.score > 0 ? '+' : ''}{e.signal.score}</b> {e.signal.stance}{against && <div className="xl-note">order placed against the signal (acknowledged)</div>}</> : '—'}
        </Step>
        <Step label="2 · Risk check" tone="ok">
          expected fill {num(e.expected?.avgPrice)}<br />slippage {signedPct(e.expected?.slippagePct)}
        </Step>
        <Step label="3 · Signed order" tone="ok">
          {side} {e.order.quantity} · LIMIT {TIF[e.order.timeInForce]} @ {e.order.price}<br /><code>{e.order.clOrdID}</code>
        </Step>
        <Step label="4 · SoDEX" tone={e.accepted ? 'ok' : 'bad'}>
          {e.accepted ? <>accepted · orderID <code>{e.orderID}</code></> : <>rejected: {e.error}</>}
        </Step>
        <Step label="5 · Fill" tone={filled ? 'ok' : e.accepted ? 'warn' : 'bad'}>
          {filled ? (
            <>
              {num(e.filledQty, 6)} @ <b>{num(e.avgFill)}</b><br />
              vs expected {signedPct(e.slippageVsExpectedPct)}
              <div className="xl-note">fee {e.fills.reduce((s, f) => s + f.fee, 0).toPrecision(3)} {e.fills[0].feeCoin} · {e.fills[0].isMaker ? 'maker' : 'taker'}</div>
            </>
          ) : e.accepted ? 'no fill (IOC expired: price moved beyond the cap)' : '—'}
        </Step>
        {e.markPrice != null && (
          <Step label="Now" tone={e.unrealizedPnl >= 0 ? 'ok' : 'bad'}>
            mark {num(e.markPrice)}<br />
            <b style={{ color: e.unrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{e.unrealizedPnl >= 0 ? '+' : ''}{num(e.unrealizedPnl, 4)} USDC ({signedPct(e.unrealizedPct, 2)})</b>
          </Step>
        )}
      </div>
    </div>
  )
}

export default function ExecutionLog() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(() => {
    setError(null)
    getExecutions().then(setRows).catch(e => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="fade-in">
      <div className="desk-toolbar">
        <div>Every order placed from FinPulse, from the signal on screen to the actual fill on SoDEX testnet. Fills are read back from the exchange, not from our own records.</div>
        <button className="btn btn-sm btn-outline" onClick={load}>↻ Refresh</button>
      </div>
      {error && <div className="error-box">Execution log unavailable: {error}</div>}
      {!rows && !error && <div className="loading-row"><div className="loading-spinner" /> Loading executions…</div>}
      {rows?.length === 0 && <div className="card">No orders yet. Open a trade ticket on the Scores tab to place one on SoDEX testnet.</div>}
      {rows?.length > 0 && (
        <>
          <div className="ledger-stats">
            <div className="stat-pill">Orders <span className="stat-value">{rows.length}</span></div>
            <div className="stat-pill">Accepted <span className="stat-value">{rows.filter(r => r.accepted).length}</span></div>
            <div className="stat-pill">Filled <span className="stat-value">{rows.filter(r => r.filledQty > 0).length}</span></div>
            <div className="stat-pill">Unrealized P&L <span className="stat-value">{num(rows.reduce((s, r) => s + (r.unrealizedPnl || 0), 0), 4)} USDC</span></div>
          </div>
          <div className="xl-list">{rows.map(e => <ExecutionCard key={e.ts + e.order.clOrdID} e={e} />)}</div>
          <p className="fine-print">Verify any order on <a href={EXPLORER} target="_blank" rel="noreferrer">testnet.sodex.com</a> by its orderID.</p>
        </>
      )}
    </div>
  )
}
