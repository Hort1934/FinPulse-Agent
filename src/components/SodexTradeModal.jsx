import { useState, useEffect } from 'react'
import { getTradePreview } from '../services/api'
import { loadSession, enableTrading, buildSpotOrder, submitSpotOrder, fetchAccount, clearSession } from '../services/sodexSigner'

const PREVIEW_MAX_AGE_MS = 20_000

function ExecutionPanel({ preview, asset, address, onReprice }) {
  const [session, setSession] = useState(() => (address ? loadSession(address) : null))
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(null) // 'enable' | 'send'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { setSession(address ? loadSession(address) : null) }, [address])

  const warnings = preview.checks.filter(c => !c.ok && c.level === 'warn')
  const age = Date.now() - preview.order.pricedAt
  const stale = age > PREVIEW_MAX_AGE_MS
  const accountID = preview.account?.accountID

  if (!address || !preview.account) {
    return <div className="fine-print">Connect your wallet above (and re-price) to trade this order on SoDEX {preview.network}.</div>
  }
  if (!accountID) {
    return <div className="error-box">No SoDEX {preview.network} account found for {address}. Open testnet.sodex.com once with this wallet to activate it.</div>
  }

  const enable = async () => {
    setBusy('enable'); setError(null)
    try { setSession(await enableTrading(address, accountID)) } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  const send = async () => {
    setBusy('send'); setError(null); setResult(null)
    try {
      const params = buildSpotOrder({
        accountID, symbolID: preview.market.symbolID, side: preview.order.side,
        price: preview.order.price, quantity: preview.order.quantity,
        clOrdID: `fp-${asset.symbol}-${Date.now()}`,
      })
      const r = await submitSpotOrder(session, params, {
        address, symbol: preview.market.symbol,
        signal: { score: asset.score, stance: asset.stance },
        expected: { avgPrice: preview.fill.avgPrice, slippagePct: preview.fill.slippagePct },
      })
      let account = null
      try { account = await fetchAccount(address) } catch { /* balances are a nice-to-have */ }
      setResult({ ...r, account })
    } catch (e) {
      setError(e.message)
      if (/api key|apikey|not found|expired/i.test(e.message)) { clearSession(address); setSession(null) }
    } finally { setBusy(null) }
  }

  if (result) {
    const rows = Array.isArray(result.data) ? result.data : [result.data]
    return (
      <div className="exec-result fade-in">
        <div className="exec-ok">✅ Order accepted by SoDEX {preview.network}</div>
        {rows.map((r, i) => (
          <div key={i} className="tp-order">
            {Object.entries(r || {}).map(([k, v]) => <div key={k}><span className="muted">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>)}
          </div>
        ))}
        <div className="fine-print">Signed nonce {result.nonce} · payload {result.payloadHash.slice(0, 18)}… · logged with FinPulse Score {asset.score} ({asset.stance}).</div>
        {result.account && (
          <div className="fine-print">Balances now: {result.account.balances.map(b => `${b.coin} ${b.total}${Number(b.locked) ? ` (${b.locked} locked)` : ''}`).join(' · ')}</div>
        )}
      </div>
    )
  }

  return (
    <div className="ticket-exec">
      {!session ? (
        <>
          <button className="btn btn-primary btn-full" onClick={enable} disabled={!!busy}>
            {busy === 'enable' ? 'Waiting for wallet signature…' : 'Enable trading · 1 wallet signature'}
          </button>
          <div className="fine-print">
            FinPulse creates a trading key in this browser and asks your wallet to authorise it on SoDEX {preview.network} for 24 hours.
            The key can place and cancel orders only; it cannot withdraw. Your wallet's own key never leaves the wallet.
          </div>
        </>
      ) : (
        <>
          {warnings.length > 0 && (
            <label className="ack">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
              I have read the {warnings.length} warning{warnings.length > 1 ? 's' : ''} above and still want to place this order.
            </label>
          )}
          {stale ? (
            <button className="btn btn-outline btn-full" onClick={onReprice}>Price is {Math.round(age / 1000)}s old — re-price before sending</button>
          ) : (
            <button className="btn btn-primary btn-full" onClick={send} disabled={!!busy || (warnings.length > 0 && !ack)}>
              {busy === 'send' ? 'Signing & sending…' : `Sign & send ${preview.order.side.toUpperCase()} ${preview.order.quantity} ${preview.market.base} · ${Math.max(0, Math.round((PREVIEW_MAX_AGE_MS - age) / 1000))}s`}
            </button>
          )}
          <div className="fine-print">
            Trading key <code>{session.name}</code> active until {new Date(session.expiresAt).toLocaleTimeString()}.{' '}
            <button className="link-btn" onClick={() => { clearSession(address); setSession(null) }}>Forget key</button>
          </div>
        </>
      )}
      {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  )
}

const ADDR_KEY = 'finpulse_wallet_address'
const loadAddr = () => { try { return localStorage.getItem(ADDR_KEY) || '' } catch { return '' } }
const saveAddr = a => { try { localStorage.setItem(ADDR_KEY, a) } catch { /* private mode */ } }
const fmt = (x, d = 2) => (x == null ? '—' : Number(x).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }))

export default function SodexTradeModal({ isOpen, onClose, asset }) {
  const [side, setSide] = useState('buy')
  const [usd, setUsd] = useState('20')
  const [address, setAddress] = useState(loadAddr)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPreview(null); setError(null)
    // Spot desk: default to Buy; Sell is offered for trimming existing holdings.
    setSide('buy')
  }, [isOpen, asset])

  if (!isOpen || !asset) return null

  const connect = async () => {
    if (!window.ethereum) { setError('No browser wallet found. Paste your address instead.'); return }
    try {
      const [a] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAddress(a); saveAddr(a)
    } catch (e) { setError(e.message) }
  }

  const runPreview = async () => {
    setLoading(true); setError(null); setPreview(null)
    try {
      const addr = /^0x[0-9a-fA-F]{40}$/.test(address) ? address : undefined
      if (addr) saveAddr(addr)
      setPreview(await getTradePreview({ symbol: asset.sodexSymbol, side, usd: Number(usd), address: addr }))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const close = () => { setPreview(null); setError(null); onClose() }

  return (
    <div className="modal-overlay fade-in" onClick={e => e.target === e.currentTarget && close()}>
      <div className="modal-content ticket">
        <div className="modal-header">
          <h3>⚡ SoDEX trade ticket · {asset.symbol}</h3>
          <button onClick={close} className="close-btn" aria-label="Close">&times;</button>
        </div>

        <div className="modal-body">
          <div className="ticket-signal">
            <span>FinPulse Score <b style={{ color: asset.score >= 25 ? 'var(--accent-green)' : asset.score <= -25 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>{asset.score > 0 ? '+' : ''}{asset.score}</b> · {asset.stance} · confidence {asset.confidence}%</span>
            <span className="badge badge-purple">SoDEX testnet · {asset.sodexSymbol}</span>
          </div>

          <div className="ticket-row">
            <div className="seg">
              <button className={side === 'buy' ? 'on buy' : ''} onClick={() => { setSide('buy'); setPreview(null) }}>Buy</button>
              <button className={side === 'sell' ? 'on sell' : ''} onClick={() => { setSide('sell'); setPreview(null) }}>Sell</button>
            </div>
            <div className="input-wrapper ticket-amount">
              <span className="input-prefix">$</span>
              <input type="number" min="0" value={usd} onChange={e => { setUsd(e.target.value); setPreview(null) }} aria-label="Amount in USDC" />
            </div>
          </div>

          <div className="ticket-row">
            <input className="ticket-addr" placeholder="Wallet address (0x…) for balance checks" value={address} onChange={e => { setAddress(e.target.value.trim()); setPreview(null) }} />
            <button className="btn btn-sm btn-outline" onClick={connect}>Connect wallet</button>
          </div>

          <button className="btn btn-primary btn-full" onClick={runPreview} disabled={loading || !(Number(usd) > 0)}>
            {loading ? 'Pricing against the live book…' : 'Price & risk-check order'}
          </button>

          {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}

          {preview && (
            <div className="ticket-preview fade-in">
              <div className="tp-grid">
                <div><label>Best bid / ask</label><span>{fmt(preview.book.bestBid)} / {fmt(preview.book.bestAsk)}</span></div>
                <div><label>Spread</label><span>{preview.book.spreadPct == null ? 'one-sided' : `${preview.book.spreadPct.toFixed(3)}%`}</span></div>
                <div><label>Expected avg fill</label><span>{fmt(preview.fill.avgPrice)}</span></div>
                <div><label>Expected slippage</label><span>{preview.fill.slippagePct?.toFixed(3) ?? '—'}%</span></div>
                <div><label>Book levels used</label><span>{preview.fill.levelsUsed}</span></div>
                <div><label>Est. taker fee</label><span>{fmt(preview.fill.estFee, 4)} {preview.market.quote}</span></div>
              </div>

              {preview.order && (
                <div className="tp-order">
                  <b>Order to sign:</b> {preview.order.side.toUpperCase()} {preview.order.quantity} {preview.market.base} · {preview.order.type} {preview.order.timeInForce} @ {preview.order.price}
                  <div className="fine-print">{preview.order.note}</div>
                </div>
              )}

              <ul className="checks">
                {preview.checks.map(c => (
                  <li key={c.id} className={c.ok ? 'ok' : c.level === 'block' ? 'block' : 'warn'}>
                    <span>{c.ok ? '✓' : c.level === 'block' ? '✕' : '!'}</span>{c.message}
                  </li>
                ))}
              </ul>

              {preview.blocked ? (
                <div className="error-box">
                  {preview.order?.side === 'sell' && preview.checks.some(c => c.id === 'balance' && !c.ok) ? (
                    <>
                      You hold no {preview.market.base}, so there is nothing to sell. On spot, a REDUCE signal means
                      “trim what you hold”, not “open a short”.{' '}
                      <button className="link-btn" onClick={() => { setSide('buy'); setPreview(null) }}>Switch to Buy</button>
                    </>
                  ) : `Blocked by: ${preview.checks.filter(c => !c.ok && c.level === 'block').map(c => c.message).join('; ')}`}
                </div>
              ) : (
                <ExecutionPanel preview={preview} asset={asset} address={preview.account?.address} onReprice={runPreview} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
