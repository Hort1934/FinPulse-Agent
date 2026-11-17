import { useState, useEffect, useMemo } from 'react'
import { getMarketSnapshot, getSectorSpotlight, getSignals } from '../services/api'

function formatNumber(num) {
  if (num == null || !Number.isFinite(num)) return '—'
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

function FearGreedGauge({ value, caption }) {
  const angle = 180 + (value / 100) * 180
  const getColor = (v) => {
    if (v < 25) return '#ef4444'
    if (v < 45) return '#f97316'
    if (v < 55) return '#f59e0b'
    if (v < 75) return '#84cc16'
    return '#10b981'
  }
  const getLabel = (v) => {
    if (v < 25) return 'Extreme Fear'
    if (v < 45) return 'Fear'
    if (v < 55) return 'Neutral'
    if (v < 75) return 'Greed'
    return 'Extreme Greed'
  }
  const color = getColor(value)

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" viewBox="0 0 200 120">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="251" strokeDashoffset={251 - (value / 100) * 251} style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <line x1="100" y1="100" x2={100 + 55 * Math.cos((angle * Math.PI) / 180)} y2={100 + 55 * Math.sin((angle * Math.PI) / 180)} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 1s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
        <circle cx="100" cy="100" r="6" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="gauge-value" style={{ color }}>{value}</div>
      <div className="gauge-label">{getLabel(value)}</div>
      {caption && <div className="fine-print" style={{ textAlign: 'center', maxWidth: 220 }}>{caption}</div>}
    </div>
  )
}

function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 10 + Math.random() * 20,
      size: 1 + Math.random() * 2,
    }))
  , [])

  return (
    <div className="particles-bg">
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: `${p.left}%`,
          bottom: '-10px',
          width: p.size,
          height: p.size,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
        }} />
      ))}
    </div>
  )
}

const TOP_COINS = [
  { id: '1673723677362319866', symbol: 'BTC', name: 'Bitcoin' },
  { id: '1673723677362319867', symbol: 'ETH', name: 'Ethereum' },
  { id: '1673723677362319875', symbol: 'SOL', name: 'Solana' },
  { id: '1673723677362319869', symbol: 'BNB', name: 'BNB' },
  { id: '1673723677362319871', symbol: 'XRP', name: 'XRP' },
  { id: '1673723677362319873', symbol: 'ADA', name: 'Cardano' },
  { id: '1673723677362319883', symbol: 'AVAX', name: 'Avalanche' },
  { id: '1673723677362319877', symbol: 'DOT', name: 'Polkadot' },
]

export default function MarketPulse() {
  const [marketData, setMarketData] = useState([])
  const [sectors, setSectors] = useState([])
  const [dominance, setDominance] = useState({})
  const [sentiment, setSentiment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      const [sectorData, snaps] = await Promise.all([
        getSectorSpotlight(),
        Promise.all(TOP_COINS.map(c => getMarketSnapshot(c.id).then(s => ({ c, s })).catch(() => ({ c, s: null })))),
      ])
      if (!alive) return
      const sectorArray = Array.isArray(sectorData) ? sectorData : (sectorData?.sector || [])
      setSectors(sectorArray.map(s => ({ name: s.name, change: Number(((s.change_pct_24h ?? 0) * 100).toFixed(2)) })))
      setDominance(Object.fromEntries(sectorArray.map(s => [s.name, s.marketcap_dom])))
      setMarketData(snaps.filter(x => x.s && x.s.price).map(({ c, s }) => ({
        id: c.id, name: c.symbol, fullName: c.name,
        price: s.price, change: (s.change_pct_24h || 0) * 100,
        marketCap: s.marketcap || 0, volume: s.turnover_24h || 0,
      })))
      setLoading(false)
    }
    load()
    // Sentiment gauge = average FinPulse Score, not a random number.
    getSignals({ record: false }).then(s => {
      const scored = s.assets.filter(a => a.score != null)
      if (alive && scored.length) setSentiment(Math.round(scored.reduce((t, a) => t + a.score, 0) / scored.length))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const btc = marketData.find(c => c.name === 'BTC')
  const btcDom = dominance.BTC
  // Whole-market cap derived from BTC market cap and BTC dominance (both SoSoValue).
  const totalMcap = btc && btcDom ? btc.marketCap / btcDom : null
  const trackedVol = marketData.reduce((s, c) => s + c.volume, 0)
  const trackedMcap = marketData.reduce((s, c) => s + c.marketCap, 0)
  const mcapWeightedChange = trackedMcap ? marketData.reduce((s, c) => s + c.change * c.marketCap, 0) / trackedMcap : null
  const gauge = sentiment == null ? null : Math.round((sentiment + 100) / 2)

  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      <Particles />

      {/* Ticker Strip */}
      <div style={{ overflow: 'hidden', marginBottom: 24, position: 'relative' }}>
        <div className="ticker-strip">
          {[...marketData, ...marketData].map((coin, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-symbol">{coin.name}</span>
              <span className="ticker-price">${formatPrice(coin.price)}</span>
              <span className={`card-change ${coin.change >= 0 ? 'positive' : 'negative'}`}>
                {coin.change >= 0 ? '▲' : '▼'} {Math.abs(coin.change).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">📈 Total Market Cap</div>
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{loading ? '…' : formatNumber(totalMcap)}</div>
          {mcapWeightedChange != null && (
            <div className={`card-change ${mcapWeightedChange >= 0 ? 'positive' : 'negative'}`} style={{ marginTop: 8 }} title="Market-cap-weighted 24h change of the 8 tracked assets">
              {mcapWeightedChange >= 0 ? '▲' : '▼'} {Math.abs(mcapWeightedChange).toFixed(2)}% (top 8, 24h)
            </div>
          )}
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">💰 24h Volume · top 8</div>
          <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{loading ? '…' : formatNumber(trackedVol)}</div>
          {trackedMcap > 0 && (
            <div className="stat-pill" style={{ marginTop: 8 }}>
              <span>Turnover</span> <span className="stat-value">{((trackedVol / trackedMcap) * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏆 BTC Dominance</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)' }}>{btcDom == null ? (loading ? '…' : '—') : `${(btcDom * 100).toFixed(1)}%`}</div>
          {dominance.ETH != null && <div className="stat-pill" style={{ marginTop: 8 }}><span>ETH</span> <span className="stat-value">{(dominance.ETH * 100).toFixed(1)}%</span></div>}
        </div>
        <div className="card fade-in stagger-4">
          <div className="card-title">🪙 Stablecoin Share</div>
          <div className="card-value" style={{ color: 'var(--accent-purple)' }}>{dominance.StableCoin == null ? (loading ? '…' : '—') : `${(dominance.StableCoin * 100).toFixed(1)}%`}</div>
          <div className="stat-pill" style={{ marginTop: 8 }}><span>of total market cap</span></div>
        </div>
      </div>

      {/* Fear & Greed + Top Assets */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card fade-in stagger-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {gauge == null
            ? <div className="loading-row"><div className="loading-spinner" /> Scoring market…</div>
            : <FearGreedGauge value={gauge} caption={`Average FinPulse Score ${sentiment > 0 ? '+' : ''}${sentiment} across BTC, ETH, SOL, XRP, BNB`} />}
        </div>

        <div className="card fade-in stagger-4" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div className="card-title">🏅 Top Assets by Market Cap</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset</th>
                <th>Price</th>
                <th>24h</th>
                <th>Market Cap</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {marketData.slice(0, 5).map((coin, i) => (
                <tr key={coin.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{coin.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{coin.fullName}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${formatPrice(coin.price)}</td>
                  <td>
                    <span className={`card-change ${coin.change >= 0 ? 'positive' : 'negative'}`}>
                      {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatNumber(coin.marketCap)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{formatNumber(coin.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Heatmap */}
      <div className="card fade-in stagger-5">
        <div className="card-header">
          <div className="card-title">🗺️ Sector Heatmap</div>
          <div className="badge badge-cyan">Live</div>
        </div>
        <div className="heatmap-grid">
          {sectors.map((sector) => {
            const intensity = Math.min(Math.abs(sector.change) / 8, 1)
            const bg = sector.change >= 0
              ? `rgba(16, 185, 129, ${0.1 + intensity * 0.4})`
              : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`
            return (
              <div key={sector.name} className="heatmap-cell" style={{ background: bg }}>
                <div className="cell-name">{sector.name}</div>
                <div className="cell-value" style={{ color: sector.change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {sector.change >= 0 ? '+' : ''}{sector.change}%
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
