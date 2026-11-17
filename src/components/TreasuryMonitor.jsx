import { useState, useEffect } from 'react'
import { getBTCTreasuries, getBTCPurchaseHistory, getMarketSnapshot } from '../services/api'

function formatBig(num) {
  if (num == null || !Number.isFinite(num)) return '—'
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const BTC_ID = '1673723677362319866'

export default function TreasuryMonitor() {
  const [treasuries, setTreasuries] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)

  const [btc, setBtc] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      // Live BTC price and circulating supply from SoSoValue. No fallback price:
      // if this fails the USD columns show a dash instead of a made-up number.
      let snap = null
      try { snap = await getMarketSnapshot(BTC_ID) } catch { /* handled below */ }
      const price = snap?.price || null
      const supply = Number(snap?.circulating_supply) || null
      if (alive) setBtc(price ? { price, supply } : null)

      const data = await getBTCTreasuries()
      const list = Array.isArray(data) ? data : (data?.list || data?.data || [])
      let rows = list.map(t => ({
        company: t.name || 'Unknown', ticker: t.ticker, country: t.list_location || '',
        btcHeld: 0, valueUsd: null, percentOfSupply: null, rank: 0,
        lastBuy: null, change30d: null, asOf: null,
      }))
      if (alive) setTreasuries(rows)

      // The server queue rate-limits and caches; chunks let the table fill progressively.
      for (let i = 0; i < rows.length && alive; i += 5) {
        await Promise.all(rows.slice(i, i + 5).map(async t => {
          try {
            const hist = await getBTCPurchaseHistory(t.ticker)
            const h = (Array.isArray(hist) ? hist : (hist?.data || [])).slice().sort((x, y) => y.date.localeCompare(x.date))
            if (!h.length) return
            t.btcHeld = parseFloat(h[0].btc_holding) || 0
            t.asOf = h[0].date
            t.valueUsd = price ? t.btcHeld * price : null
            t.percentOfSupply = supply ? (t.btcHeld / supply) * 100 : null
            const buy = h.find(x => Number(x.btc_acq) > 0)
            if (buy) {
              const qty = Number(buy.btc_acq), cost = Number(buy.acq_cost)
              t.lastBuy = { date: buy.date, qty, avgPrice: cost > 0 ? cost / qty : null }
            }
            const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
            const old = h.find(x => x.date <= cutoff)
            if (old) t.change30d = t.btcHeld - (parseFloat(old.btc_holding) || 0)
          } catch { /* leave row empty */ }
        }))
        rows = [...rows].sort((a, b) => b.btcHeld - a.btcHeld).map((t, idx) => ({ ...t, rank: idx + 1 }))
        if (alive) setTreasuries(rows)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const totalBTC = treasuries.reduce((s, t) => s + (t.btcHeld || 0), 0)
  const totalValue = treasuries.reduce((s, t) => s + (t.valueUsd || 0), 0)
  const totalSupplyPct = treasuries.reduce((s, t) => s + (t.percentOfSupply || 0), 0)
  const net30 = treasuries.reduce((s, t) => s + (t.change30d || 0), 0)

  return (
    <div className="fade-in">
      {/* Summary Stats */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">₿ Total BTC Held</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)' }}>{totalBTC.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{btc?.supply ? `${totalSupplyPct.toFixed(2)}% of circulating supply` : 'circulating supply unavailable'}</div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">💰 Total Value</div>
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{formatBig(totalValue)}</div>
          <div className="stat-pill" style={{ marginTop: 8 }}>{btc ? <>at BTC <span className="stat-value">${btc.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></> : 'BTC price unavailable'}</div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏢 Companies Tracked</div>
          <div className="card-value" style={{ color: 'var(--accent-purple)' }}>{treasuries.length}</div>
          <div className="stat-pill" style={{ marginTop: 8 }}>Net 30d change <span className="stat-value">{net30 >= 0 ? '+' : ''}{net30.toLocaleString()} BTC</span></div>
        </div>
      </div>

      {/* Holdings Visualization */}
      <div className="card fade-in stagger-4" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>📊 Holdings Distribution</div>
        <div style={{ display: 'flex', gap: 4, height: 40, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {treasuries.map((t, i) => {
            const colors = ['#22d3ee', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444']
            const width = (t.btcHeld / totalBTC) * 100
            return (
              <div
                key={t.ticker}
                style={{
                  width: `${width}%`,
                  background: colors[i % colors.length],
                  opacity: selectedCompany === t.ticker ? 1 : 0.7,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={() => setSelectedCompany(t.ticker)}
                onMouseLeave={() => setSelectedCompany(null)}
                title={`${t.company}: ${t.btcHeld.toLocaleString()} BTC`}
              >
                {width > 8 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--bg-primary)' }}>
                    {t.ticker}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {treasuries.slice(0, 10).map((t, i) => {
            const colors = ['#22d3ee', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444']
            return (
              <div key={t.ticker} className="pie-legend-item" style={{ fontSize: 11 }}>
                <div className="pie-legend-dot" style={{ background: colors[i % colors.length] }} />
                <span>{t.company}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Treasury Table */}
      <div className="card fade-in stagger-5">
        <div className="card-header">
          <div className="card-title">🏦 Corporate BTC Treasury Leaderboard</div>
          <div className="fine-print" style={{ margin: 0 }}>SoSoValue purchase filings · USD at live BTC price</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Company</th>
              <th>Ticker</th>
              <th>BTC Held</th>
              <th>Value (USD)</th>
              <th>% of Supply</th>
              <th>30d change</th>
              <th>Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {treasuries.map((t) => (
              <tr key={t.ticker} style={{ background: selectedCompany === t.ticker ? 'var(--bg-card-hover)' : undefined }}>
                <td className="rank">#{t.rank}</td>
                <td style={{ fontWeight: 600 }}>{t.company}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{t.ticker}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.btcHeld.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatBig(t.valueUsd)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, maxWidth: 80 }}>
                      <div style={{ height: '100%', width: `${Math.min((t.percentOfSupply || 0) * 20, 100)}%`, background: 'var(--accent-yellow)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.percentOfSupply == null ? '—' : `${t.percentOfSupply.toFixed(3)}%`}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: t.change30d > 0 ? 'var(--accent-green)' : t.change30d < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{t.change30d == null ? '—' : `${t.change30d > 0 ? '+' : ''}${t.change30d.toLocaleString()}`}</td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.lastBuy ? <>{t.lastBuy.date} · +{t.lastBuy.qty.toLocaleString()} BTC{t.lastBuy.avgPrice ? ` @ ${formatBig(t.lastBuy.avgPrice)}` : ''}</> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
