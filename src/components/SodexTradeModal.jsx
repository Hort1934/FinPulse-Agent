import { useState, useEffect } from 'react'
import { getTradePreview } from '../services/api'

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
    if (asset?.stance === 'REDUCE') setSide('sell')
    else setSide('buy')
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
                <div><label>Spread</label><span>{preview.book.spreadPct.toFixed(3)}%</span></div>
                <div><label>Expected avg fill</label><span>{fmt(preview.fill.avgPrice)}</span></div>
                <div><label>Expected slippage</label><span>{preview.fill.slippagePct?.toFixed(3) ?? '—'}%</span></div>
                <div><label>Book levels used</label><span>{preview.fill.levelsUsed}</span></div>
                <div><label>Est. taker fee</label><span>{fmt(preview.fill.estFee, 4)} {preview.market.quote}</span></div>
              </div>

              <div className="tp-order">
                <b>Order to sign:</b> {preview.order.side.toUpperCase()} {preview.order.quantity} {preview.market.base} · {preview.order.type} {preview.order.timeInForce} @ {preview.order.price}
                <div className="fine-print">{preview.order.note}</div>
              </div>

              <ul className="checks">
                {preview.checks.map(c => (
                  <li key={c.id} className={c.ok ? 'ok' : c.level === 'block' ? 'block' : 'warn'}>
                    <span>{c.ok ? '✓' : c.level === 'block' ? '✕' : '!'}</span>{c.message}
                  </li>
                ))}
              </ul>

              {preview.blocked ? (
                <div className="error-box">Blocked by risk rules. Adjust size or side.</div>
              ) : (
                <div className="ticket-exec">
                  <button className="btn btn-primary btn-full" disabled title="Wallet signing (EIP-712) is being integrated">
                    Sign & send with wallet — coming next
                  </button>
                  <div className="fine-print">
                    Pricing and risk checks above use the live SoDEX {preview.network} order book (block {preview.book.blockHeight}).
                    Nothing has been sent. Until wallet signing lands you can place this exact order on <a href="https://testnet.sodex.com" target="_blank" rel="noreferrer">testnet.sodex.com</a>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
