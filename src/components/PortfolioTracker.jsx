import { useState, useEffect, useMemo, useRef } from 'react'
import { getCurrencyList, getMarketSnapshot, getKlines, getIndexMarketSnapshot } from '../services/api'
import { fetchAccount } from '../services/sodexSigner'

const STORE = 'finpulse_portfolio_v2'
const ADDR_KEY = 'finpulse_wallet_address'
const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'FDUSD'])
const DAY = 86_400_000

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch { /* private mode */ } }

function usd(num) {
  if (num == null || !Number.isFinite(num)) return '—'
  const sign = num < 0 ? '-' : ''
  const a = Math.abs(num)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`
  return `${sign}$${a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const pct = x => (x == null || !Number.isFinite(x) ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%`)

/** SoDEX coin names -> SoSoValue symbols: vBTC -> BTC, vUSDC -> USDC, WSOSO -> SOSO. */
function sodexToSymbol(coin) {
  if (/^v[A-Z]/.test(coin)) return coin.slice(1)
  if (coin === 'WSOSO') return 'SOSO'
  return coin
}

/** Close price ~n days ago from ascending daily candles. */
function closeDaysAgo(candles, n) {
  const target = Date.now() - n * DAY
  let best = null
  for (const c of candles) if (c.t <= target) best = c
  return best?.close ?? null
}

export default function PortfolioTracker() {
  const [holdings, setHoldings] = useState(() => load(STORE, []))
  const [ids, setIds] = useState({})
  const [market, setMarket] = useState({}) // symbol -> { price, change24h, candles }
  const [bench, setBench] = useState(null)
  const [form, setForm] = useState({ symbol: '', amount: '' })
  const [address, setAddress] = useState(() => { try { return localStorage.getItem(ADDR_KEY) || '' } catch { return '' } })
  const [msg, setMsg] = useState(null)
  const requested = useRef(new Set())

  useEffect(() => { save(STORE, holdings) }, [holdings])

  // Symbol -> SoSoValue currency id (first match = highest-ranked listing).
  useEffect(() => {
    getCurrencyList().then(list => {
      const map = {}
      for (const c of Array.isArray(list) ? list : []) {
        const k = c.symbol.toUpperCase()
        if (!map[k]) map[k] = c.currency_id
      }
      setIds(map)
    })
    getIndexMarketSnapshot('ssiMAG7').then(s => s?.price !== undefined && setBench(s))
  }, [])

  const symbols = useMemo(() => [...new Set(holdings.map(h => h.symbol))], [holdings])

  useEffect(() => {
    let alive = true
    for (const sym of symbols) {
      if (requested.current.has(sym) || !Object.keys(ids).length) continue
      requested.current.add(sym)
      const id = ids[sym]
      if (!id) { setMarket(m => ({ ...m, [sym]: { missing: true } })); continue }
      Promise.all([getMarketSnapshot(id), getKlines(id, { interval: '1d', limit: 40 })]).then(([snap, kl]) => {
        if (!alive) return
        const candles = (Array.isArray(kl) ? kl : []).map(k => ({ t: Number(k.timestamp), close: Number(k.close) })).sort((a, b) => a.t - b.t)
        setMarket(m => ({ ...m, [sym]: { price: snap?.price ?? null, change24h: snap?.change_pct_24h ?? null, candles } }))
      })
    }
    return () => { alive = false }
  }, [symbols, ids])

  const priceOf = sym => (STABLES.has(sym) && market[sym]?.price == null ? 1 : market[sym]?.price)

  const rows = holdings.map(h => {
    const m = market[h.symbol] || {}
    const price = priceOf(h.symbol)
    return { ...h, price, change24h: STABLES.has(h.symbol) ? (m.change24h ?? 0) : m.change24h, value: price != null ? h.amount * price : null, missing: m.missing }
  })
  const total = rows.reduce((s, r) => s + (r.value || 0), 0)

  // Portfolio return over n days, holding today's amounts constant (no trades).
  function portfolioReturn(days) {
    let now = 0, then = 0
    for (const r of rows) {
      if (r.value == null) continue
      let past
      if (days === 1) past = r.change24h == null ? null : r.price / (1 + r.change24h)
      else past = STABLES.has(r.symbol) ? r.price : closeDaysAgo(market[r.symbol]?.candles || [], days)
      if (past == null) return null
      now += r.amount * r.price
      then += r.amount * past
    }
    return then > 0 ? now / then - 1 : null
  }

  const periods = [
    { label: '24h', days: 1, benchKey: 'change_pct_24h' },
    { label: '7d', days: 7, benchKey: 'roi_7d' },
    { label: '30d', days: 30, benchKey: 'roi_1m' },
  ].map(p => {
    const mine = rows.length ? portfolioReturn(p.days) : null
    const idx = bench?.[p.benchKey] ?? null
    return { ...p, mine, idx, alpha: mine != null && idx != null ? mine - idx : null }
  })
  const pnl24 = periods[0].mine != null ? total - total / (1 + periods[0].mine) : null

  const add = () => {
    const symbol = form.symbol.trim().toUpperCase()
    const amount = Number(form.amount)
    if (!symbol || !(amount > 0)) return
    setHoldings(h => [...h.filter(x => x.symbol !== symbol), { symbol, amount, source: 'manual' }])
    setForm({ symbol: '', amount: '' })
  }

  const importSodex = async () => {
    setMsg(null)
    const addr = address.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { setMsg('Enter a valid wallet address.'); return }
    try {
      const acc = await fetchAccount(addr)
      save(ADDR_KEY, addr)
      const fromSodex = acc.balances.filter(b => Number(b.total) > 0).map(b => ({ symbol: sodexToSymbol(b.coin), amount: Number(b.total), source: 'SoDEX testnet' }))
      setHoldings(h => [...h.filter(x => x.source !== 'SoDEX testnet' && !fromSodex.some(f => f.symbol === x.symbol)), ...fromSodex])
      setMsg(`Imported ${fromSodex.length} balance(s) from SoDEX ${acc.network?.name || 'testnet'} account ${acc.accountID}. Valued at SoSoValue market prices.`)
    } catch (e) { setMsg(`Import failed: ${e.message}`) }
  }

  return (
    <div className="fade-in">
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">💼 Total value</div>
          <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{rows.length ? usd(total) : '—'}</div>
          <div className={`card-change ${(periods[0].mine ?? 0) >= 0 ? 'positive' : 'negative'}`} style={{ marginTop: 8 }}>{pct(periods[0].mine)} (24h)</div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">📈 24h P&L</div>
          <div className="card-value" style={{ color: (pnl24 ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pnl24 == null ? '—' : `${pnl24 >= 0 ? '+' : ''}${usd(pnl24)}`}</div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏆 Benchmark vs SSI MAG7</div>
          <table className="bench-table">
            <thead><tr><th></th><th>You</th><th>MAG7</th><th>Alpha</th></tr></thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.label}>
                  <td>{p.label}</td><td>{pct(p.mine)}</td><td>{pct(p.idx)}</td>
                  <td style={{ color: p.alpha == null ? 'inherit' : p.alpha >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>{p.alpha == null ? '—' : `${p.alpha >= 0 ? '+' : ''}${(p.alpha * 100).toFixed(2)} pp`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fine-print" style={{ marginBottom: 0 }}>Holds today's amounts constant over each period. MAG7 returns from the SoSoValue index snapshot.</div>
        </div>
      </div>

      <div className="card fade-in stagger-4" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>➕ Holdings</div>
        <div className="pf-controls">
          <div className="pf-group">
            <input className="ticket-addr" placeholder="Symbol (e.g. BTC)" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} style={{ maxWidth: 160 }} />
            <input className="ticket-addr" placeholder="Amount" type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ maxWidth: 140 }} onKeyDown={e => e.key === 'Enter' && add()} />
            <button className="btn btn-sm btn-outline" onClick={add}>Add</button>
          </div>
          <div className="pf-group">
            <input className="ticket-addr" placeholder="Wallet address (0x…)" value={address} onChange={e => setAddress(e.target.value)} />
            <button className="btn btn-sm btn-outline trade-btn" onClick={importSodex}>Import SoDEX balances</button>
          </div>
        </div>
        {msg && <div className="fine-print">{msg}</div>}
      </div>

      <div className="card fade-in stagger-5">
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Source</th><th>Amount</th><th>Price</th><th>24h</th><th>Value</th><th>Weight</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const w = total > 0 && r.value != null ? (r.value / total) * 100 : 0
              return (
                <tr key={r.symbol}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{r.symbol}</td>
                  <td className="muted">{r.source || 'manual'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.amount}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.missing ? <span className="muted">not on SoSoValue</span> : r.price == null ? '…' : `$${r.price.toLocaleString(undefined, { maximumFractionDigits: r.price < 1 ? 6 : 2 })}`}</td>
                  <td className={(r.change24h ?? 0) >= 0 ? 'positive' : 'negative'}>{pct(r.change24h)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{usd(r.value)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, maxWidth: 80 }}>
                        <div style={{ height: '100%', width: `${w}%`, background: 'var(--accent-cyan)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{w.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><button className="link-btn" onClick={() => setHoldings(h => h.filter(x => x.symbol !== r.symbol))} aria-label={`Remove ${r.symbol}`}>✕</button></td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No holdings yet. Add an asset above or import your SoDEX testnet balances.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
