import { useState, useEffect, useRef, useMemo } from 'react'
import { createChart, AreaSeries } from 'lightweight-charts'
import { getETFList, getIndexMarketSnapshot, getIndexConstituents, getIndexKlines } from '../services/api'

const PIE_COLORS = ['#22d3ee', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#06b6d4']

function MiniChart({ data, color = '#22d3ee' }) {
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !data?.length) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 200,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#64748b', fontSize: 10 },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
      timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
      handleScroll: false,
      handleScale: false,
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: `${color}40`,
      bottomColor: `${color}05`,
      lineColor: color,
      lineWidth: 2,
    })
    areaSeries.setData(data)
    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [data, color])

  return <div ref={containerRef} />
}

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.weight, 0)
  let currentAngle = 0

  const paths = data.map((d, i) => {
    const angle = (d.weight / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (endAngle - 90) * (Math.PI / 180)
    const largeArc = angle > 180 ? 1 : 0

    const x1 = 50 + 40 * Math.cos(startRad)
    const y1 = 50 + 40 * Math.sin(startRad)
    const x2 = 50 + 40 * Math.cos(endRad)
    const y2 = 50 + 40 * Math.sin(endRad)

    return (
      <path
        key={i}
        d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={PIE_COLORS[i % PIE_COLORS.length]}
        opacity="0.85"
        stroke="var(--bg-card)"
        strokeWidth="1"
        style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0.85'}
      >
        <title>{d.name}: {d.weight.toFixed(1)}%</title>
      </path>
    )
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 100 100" width="160" height="160">{paths}</svg>
      <div className="pie-legend">
        {data.map((d, i) => (
          <div key={d.name} className="pie-legend-item">
            <div className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span style={{ flex: 1 }}>{d.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{d.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatBig(num) {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toLocaleString()}`
}

export default function IndexHub() {
  const [indices, setIndices] = useState([])
  const [selectedIndex, setSelectedIndex] = useState('')
  const [etfs, setEtfs] = useState([])
  const [timeframe, setTimeframe] = useState('3M')
  const [chartData, setChartData] = useState([])
  const [constituents, setConstituents] = useState([])
  const [tab, setTab] = useState('indices')

  useEffect(() => {
    async function load() {
      // Fetch ETFs
      const etfList = await getETFList()
      if (etfList) {
        // Assume etfList is array of ETFs or contains a data array
        const etfArray = Array.isArray(etfList) ? etfList : (etfList.data || [])
        setEtfs(etfArray.slice(0, 5))
      }

      // Fetch Indices (we manually fetch 2 for demo to save rate limits)
      const targetIndices = [
        { ticker: 'ssimag7', name: 'SSI MAG7', description: 'Top 7 Crypto Assets' },
        { ticker: 'ssiDeFi', name: 'SSI DeFi', description: 'DeFi Sector Index' }
      ]
      const idxData = []
      for (const idx of targetIndices) {
        const snap = await getIndexMarketSnapshot(idx.ticker)
        if (snap) {
          idxData.push({
            ...idx,
            price: snap.price,
            change: snap.change_pct_24h * 100
          })
        }
      }
      if (idxData.length > 0) {
        setIndices(idxData)
        setSelectedIndex(idxData[0].ticker)
      }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadDetails() {
      if (!selectedIndex) return
      
      const cons = await getIndexConstituents(selectedIndex)
      if (cons) {
        const consArray = Array.isArray(cons) ? cons : (cons.data || [])
        setConstituents(consArray.map(c => ({
          name: c.symbol?.toUpperCase() || c.name,
          weight: (c.weight || c.percent) * 100,
        })))
      }

      const days = timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365
      const klines = await getIndexKlines(selectedIndex, { limit: days })
      if (klines) {
        const klineArray = Array.isArray(klines) ? klines : (klines.data || [])
        setChartData(klineArray.map(k => ({
          time: Math.floor(k.timestamp / 1000),
          value: k.close
        })))
      }
    }
    loadDetails()
  }, [selectedIndex, timeframe])

  const totalETFFlow = etfs.reduce((s, e) => s + e.flow_1d, 0)
  const totalAUM = etfs.reduce((s, e) => s + e.aum, 0)

  return (
    <div className="fade-in">
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${tab === 'indices' ? 'active' : ''}`} onClick={() => setTab('indices')}>SSI Indices</button>
        <button className={`tab ${tab === 'etf' ? 'active' : ''}`} onClick={() => setTab('etf')}>Crypto ETFs</button>
      </div>

      {tab === 'indices' && (
        <>
          {/* Index Cards */}
          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            {indices.map((idx, i) => (
              <div key={idx.ticker} className={`card fade-in stagger-${i + 1}`} style={{ cursor: 'pointer', borderColor: selectedIndex === idx.ticker ? 'var(--accent-cyan)' : undefined }} onClick={() => setSelectedIndex(idx.ticker)}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{idx.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{idx.description}</div>
                  </div>
                  <div className={`card-change ${idx.change >= 0 ? 'positive' : 'negative'}`}>
                    {idx.change >= 0 ? '+' : ''}{(idx.change || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="card-value" style={{ fontSize: 24 }}>${(idx.price || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Chart + Constituents */}
          <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="chart-container fade-in stagger-3">
              <div className="chart-header">
                <div className="chart-title">📈 {indices.find(i => i.ticker === selectedIndex)?.name} Performance</div>
                <div className="chart-timeframe">
                  {['3M', '6M', '1Y'].map(tf => (
                    <button 
                      key={tf} 
                      className={timeframe === tf ? 'active' : ''} 
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <MiniChart data={chartData} color="#22d3ee" />
            </div>

            <div className="card fade-in stagger-4">
              <div className="card-title" style={{ marginBottom: 16 }}>🧩 Constituents</div>
              <PieChart data={constituents} />
            </div>
          </div>
        </>
      )}

      {tab === 'etf' && (
        <>
          {/* ETF Summary */}
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            <div className="card fade-in stagger-1">
              <div className="card-title">💼 Total AUM</div>
              <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{formatBig(totalAUM || 0)}</div>
            </div>
            <div className="card fade-in stagger-2">
              <div className="card-title">📥 Net Flow (24h)</div>
              <div className="card-value" style={{ color: totalETFFlow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {totalETFFlow >= 0 ? '+' : ''}{formatBig(totalETFFlow || 0)}
              </div>
            </div>
            <div className="card fade-in stagger-3">
              <div className="card-title">🏛️ Active ETFs</div>
              <div className="card-value" style={{ color: 'var(--accent-purple)' }}>{etfs.length}</div>
            </div>
          </div>

          {/* ETF Table */}
          <div className="card fade-in stagger-4">
            <div className="card-title" style={{ marginBottom: 16 }}>📋 ETF Overview</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th>AUM</th>
                  <th>24h Flow</th>
                  <th>Price</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {etfs.map((etf, i) => (
                  <tr key={i} className={`fade-in stagger-${i + 1}`}>
                    <td style={{ fontWeight: 600 }}>{etf.ticker || 'N/A'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{etf.name || 'Unknown'}</td>
                    <td>{formatBig(etf.aum || 0)}</td>
                    <td className={etf.flow_1d >= 0 ? 'positive' : 'negative'}>
                      {etf.flow_1d >= 0 ? '+' : ''}{formatBig(etf.flow_1d || 0)}
                    </td>
                    <td>${(etf.price || 0).toFixed(2)}</td>
                    <td className={etf.change >= 0 ? 'positive' : 'negative'}>
                      {(etf.change || 0).toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {etfs.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No ETF data available from API</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ETF Flow Chart */}
          <div className="chart-container fade-in stagger-5" style={{ marginTop: 24 }}>
            <div className="chart-header">
              <div className="chart-title">📊 ETF Flow Comparison</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 20px' }}>
              {etfs.map(etf => {
                const maxFlow = Math.max(...etfs.map(e => Math.abs(e.flow_1d)))
                const height = Math.max(20, (Math.abs(etf.flow_1d) / maxFlow) * 140)
                const color = etf.flow_1d >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                return (
                  <div key={etf.ticker} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height, background: color, borderRadius: '4px 4px 0 0', opacity: 0.7, transition: 'all 0.5s ease', marginBottom: 4 }} />
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{etf.ticker}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color }}>{formatBig(etf.flow_1d)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
