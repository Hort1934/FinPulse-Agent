import { useState, useEffect } from 'react'
import { getFundraisingProjects, getMarketSnapshot } from '../services/api'

function generateSignals(marketData) {
  return marketData.map(coin => {
    const signals = []
    let strength = 0

    // Volume spike signal
    if (coin.volume / coin.marketCap > 0.04) {
      signals.push({ type: 'Volume Spike', description: `24h volume is ${((coin.volume / coin.marketCap) * 100).toFixed(1)}% of market cap`, impact: 'high' })
      strength += 30
    }

    // Price momentum
    if (coin.change > 3) {
      signals.push({ type: 'Strong Momentum', description: `+${coin.change.toFixed(1)}% in 24h — strong upward trend`, impact: 'high' })
      strength += 25
    } else if (coin.change > 1) {
      signals.push({ type: 'Positive Trend', description: `+${coin.change.toFixed(1)}% in 24h — moderate bullish`, impact: 'medium' })
      strength += 15
    } else if (coin.change < -3) {
      signals.push({ type: 'Oversold Alert', description: `${coin.change.toFixed(1)}% drop — potential reversal zone`, impact: 'medium' })
      strength += 20
    }

    // Market cap rank
    if (coin.rank <= 5) {
      signals.push({ type: 'Blue Chip', description: `Top ${coin.rank} by market cap — institutional grade`, impact: 'low' })
      strength += 10
    }

    return { ...coin, signals, strength: Math.min(strength, 100) }
  })
    .filter(c => c.signals.length > 0)
    .sort((a, b) => b.strength - a.strength)
}

function formatBig(num) {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`
  return `$${num.toLocaleString()}`
}

export default function OpportunityEngine() {
  const [tab, setTab] = useState('signals')
  const [marketData, setMarketData] = useState([])
  const [fundraising, setFundraising] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const funds = await getFundraisingProjects()
      if (funds) {
        const fundsArray = Array.isArray(funds) ? funds : (funds.list || funds.data || [])
        setFundraising(fundsArray.map(f => ({
          name: f.project_name || f.name,
          amount: f.amount || f.funding_amount,
          date: f.date || f.funding_date,
          investors: f.investors || [],
          sector: f.sector || 'DeFi',
          valuation: f.valuation || null
        })))
      }

      // Fetch sample of market data for signals
      const topCoins = ['1673723677362319866', '1673723677362319867', '1673723677362319875', '1673723677362319869', '1673723677362319871']
      const realMarketData = []
      for (const id of topCoins) {
        const snap = await getMarketSnapshot(id)
        if (snap) {
          realMarketData.push({
            id: snap.symbol || id,
            name: snap.symbol?.toUpperCase() || id,
            price: snap.price || 0,
            change: (snap.change_pct_24h || 0) * 100,
            marketCap: snap.marketcap || 1,
            volume: snap.turnover_24h || 0,
          })
        }
      }
      setMarketData(realMarketData)
      setLoading(false)
    }
    load()
  }, [])

  const signals = generateSignals(marketData)

  return (
    <div className="fade-in">
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${tab === 'signals' ? 'active' : ''}`} onClick={() => setTab('signals')}>⚡ Signals</button>
        <button className={`tab ${tab === 'fundraising' ? 'active' : ''}`} onClick={() => setTab('fundraising')}>💰 Fundraising</button>
      </div>

      {tab === 'signals' && (
        <>
          <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
            🔍 Auto-detected {signals.length} opportunities based on volume, momentum, and market structure analysis
          </div>

          <div className="grid grid-2">
            {signals.map((signal, i) => {
              const strengthColor = signal.strength >= 60 ? 'var(--accent-green)' : signal.strength >= 30 ? 'var(--accent-yellow)' : 'var(--accent-blue)'
              return (
                <div key={signal.id} className={`opportunity-card ${signal.strength >= 60 ? 'signal-high' : signal.strength >= 30 ? 'signal-medium' : 'signal-low'} fade-in stagger-${Math.min(i + 1, 6)}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {signal.name}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{signal.fullName}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, marginTop: 2 }}>
                        ${signal.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className={`card-change ${signal.change >= 0 ? 'positive' : 'negative'}`} style={{ marginLeft: 8, fontSize: 12 }}>
                          {signal.change >= 0 ? '+' : ''}{signal.change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>SIGNAL STRENGTH</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${signal.strength}%`, background: strengthColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: strengthColor }}>{signal.strength}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {signal.signals.map((s, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                        <span className={`badge ${s.impact === 'high' ? 'badge-red' : s.impact === 'medium' ? 'badge-yellow' : 'badge-green'}`} style={{ flexShrink: 0, fontSize: 10 }}>
                          {s.type}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{s.description}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>MCap: {formatBig(signal.marketCap)}</span>
                    <span>Vol: {formatBig(signal.volume)}</span>
                    <span>Rank: #{signal.rank}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'fundraising' && (
        <>
          <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
            💰 Recent crypto project fundraising rounds — powered by SoSoValue data
          </div>

          <div className="grid grid-2">
            {fundraising.map((project, i) => (
              <div key={project.name} className={`card fade-in stagger-${Math.min(i + 1, 6)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{project.name}</div>
                    <div className="badge badge-purple" style={{ marginTop: 4 }}>{project.sector}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                      ${(project.amount / 1e6).toFixed(0)}M
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{project.round}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {project.investors.map(inv => (
                    <span key={inv} className="stat-pill" style={{ fontSize: 10 }}>{inv}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>📅 {project.date}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
