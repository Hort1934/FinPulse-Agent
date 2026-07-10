import { useState, useEffect, useMemo } from 'react'
import { getMarketSnapshot, getSectorSpotlight } from '../services/api'

function formatNumber(num) {
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

function FearGreedGauge({ value }) {
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

export default function MarketPulse() {
  const [marketData, setMarketData] = useState([])
  const [sectors, setSectors] = useState([])

  useEffect(() => {
    async function load() {
      // 1. Fetch sectors
      const sectorData = await getSectorSpotlight()
      if (sectorData) {
        const sectorArray = Array.isArray(sectorData) ? sectorData : (sectorData.sector || [])
        setSectors(sectorArray.map(s => ({
          name: s.name,
          change: s.change_pct_24h !== undefined ? (s.change_pct_24h * 100).toFixed(2) : s.change
        })))
      }

      // 2. Fetch top 8 coins sequentially (using cached backend)
      const topCoins = [
        { id: '1673723677362319866', symbol: 'BTC' },
        { id: '1673723677362319867', symbol: 'ETH' },
        { id: '1673723677362319875', symbol: 'SOL' },
        { id: '1673723677362319869', symbol: 'BNB' },
        { id: '1673723677362319871', symbol: 'XRP' },
        { id: '1673723677362319873', symbol: 'ADA' },
        { id: '1673723677362319883', symbol: 'AVAX' },
        { id: '1673723677362319877', symbol: 'DOT' }
      ]
      
      const realMarketData = []
      for (const coin of topCoins) {
        const snap = await getMarketSnapshot(coin.id)
        if (snap) {
          realMarketData.push({
            id: coin.id,
            name: coin.symbol,
            price: snap.price || 0,
            change: (snap.change_pct_24h || 0) * 100,
            marketCap: snap.marketcap || 0,
            volume: snap.turnover_24h || 0,
          })
        }
      }
      if (realMarketData.length > 0) setMarketData(realMarketData)
    }
    load()
  }, [])

  const totalMcap = marketData.reduce((s, c) => s + c.marketCap, 0)
  const totalVol = marketData.reduce((s, c) => s + c.volume, 0)
  const avgChange = marketData.length ? marketData.reduce((s, c) => s + c.change, 0) / marketData.length : 0
  const fearGreed = Math.round(50 + avgChange * 8 + (marketData.length ? Math.random() * 5 : 0))

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
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{formatNumber(totalMcap)}</div>
          <div className={`card-change ${avgChange >= 0 ? 'positive' : 'negative'}`} style={{ marginTop: 8 }}>
            {avgChange >= 0 ? '▲' : '▼'} {Math.abs(avgChange).toFixed(2)}%
          </div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">💰 24h Volume</div>
          <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{formatNumber(totalVol)}</div>
          <div className="stat-pill" style={{ marginTop: 8 }}>
            <span>Turnover</span> <span className="stat-value">4.2%</span>
          </div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏆 BTC Dominance</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)' }}>62.4%</div>
          <div className="card-change positive" style={{ marginTop: 8 }}>▲ 0.3%</div>
        </div>
        <div className="card fade-in stagger-4">
          <div className="card-title">🔥 Active Pairs</div>
          <div className="card-value" style={{ color: 'var(--accent-purple)' }}>14,892</div>
          <div className="stat-pill" style={{ marginTop: 8 }}>
            <span>New</span> <span className="stat-value">+127</span>
          </div>
        </div>
      </div>

      {/* Fear & Greed + Top Assets */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card fade-in stagger-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FearGreedGauge value={fearGreed} />
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
