import { useState, useEffect, useRef } from 'react'
import { createChart, AreaSeries } from 'lightweight-charts'
import { getETFList, getETFMarketSnapshot, getETFSummaryHistory, getIndexMarketSnapshot, getIndexConstituents } from '../services/api'

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
  if (num == null || !Number.isFinite(num)) return '—'
  const sign = num < 0 ? '-' : ''
  const a = Math.abs(num)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  return `${sign}$${a.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const INDICES = [
  { ticker: 'ssiMAG7', name: 'SSI MAG7', description: 'Top 7 crypto assets' },
  { ticker: 'ssiDeFi', name: 'SSI DeFi', description: 'DeFi sector index' },
  { ticker: 'ssiLayer1', name: 'SSI Layer1', description: 'Layer-1 sector index' },
  { ticker: 'ssiAI', name: 'SSI AI', description: 'AI sector index' },
]
const ROI_FIELDS = [['change_pct_24h', '24h'], ['roi_7d', '7d'], ['roi_1m', '1M'], ['roi_3m', '3M'], ['ytd', 'YTD'], ['roi_1y', '1Y']]
const pctStr = x => (x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%`)

function RoiBars({ snap }) {
  const rows = ROI_FIELDS.filter(([k]) => snap?.[k] != null)
  const max = Math.max(...rows.map(([k]) => Math.abs(snap[k])), 0.01)
  return (
    <div className="roi-bars">
      {rows.map(([k, label]) => {
        const v = snap[k]
        return (
          <div key={k} className="roi-row">
            <span className="roi-label">{label}</span>
            <div className="cbar-track" style={{ flex: 1, height: 10 }}>
              <div className="cbar-mid" />
              <div className="cbar-fill" style={{ left: v >= 0 ? '50%' : `${50 - (Math.abs(v) / max) * 50}%`, width: `${(Math.abs(v) / max) * 50}%`, background: v >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }} />
            </div>
            <span className="roi-value" style={{ color: v >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pctStr(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function IndexHub() {
  const [indices, setIndices] = useState([])
  const [selectedIndex, setSelectedIndex] = useState('ssiMAG7')
  const [constituents, setConstituents] = useState([])
  const [etfs, setEtfs] = useState([])
  const [etfSymbol, setEtfSymbol] = useState('BTC')
  const [summary, setSummary] = useState([])
  const [tab, setTab] = useState('indices')

  useEffect(() => {
    let alive = true
    Promise.all(INDICES.map(async idx => {
      const snap = await getIndexMarketSnapshot(idx.ticker)
      return snap?.price !== undefined ? { ...idx, snap } : null
    })).then(rows => alive && setIndices(rows.filter(Boolean)))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    getIndexConstituents(selectedIndex).then(cons => {
      const arr = Array.isArray(cons) ? cons : (cons?.data || [])
      if (alive) setConstituents(arr.map(c => ({ name: (c.symbol || c.name || '').toUpperCase(), weight: (c.weight || c.percent || 0) * 100 })).sort((a, b) => b.weight - a.weight))
    })
    return () => { alive = false }
  }, [selectedIndex])

  useEffect(() => {
    let alive = true
    async function load() {
      setEtfs([]); setSummary([])
      const [list, hist] = await Promise.all([getETFList({ symbol: etfSymbol, country_code: 'US' }), getETFSummaryHistory(etfSymbol)])
      if (!alive) return
      setSummary((Array.isArray(hist) ? hist : []).slice().sort((a, b) => a.date.localeCompare(b.date)))
      const arr = Array.isArray(list) ? list : (list?.data || [])
      const rows = await Promise.all(arr.map(async etf => {
        const snap = await getETFMarketSnapshot(etf.ticker)
        return { ...etf, date: snap?.date, aum: snap?.net_assets ?? null, flow_1d: snap?.net_inflow ?? null, price: snap?.mkt_price ?? null, traded: snap?.value_traded ?? null, fee: snap?.sponsor_fee ?? null }
      }))
      if (alive) setEtfs(rows.sort((a, b) => (b.aum || 0) - (a.aum || 0)))
    }
    load()
    return () => { alive = false }
  }, [etfSymbol])

  const latest = summary.at(-1)
  const selected = indices.find(i => i.ticker === selectedIndex)
  const flowSeries = summary.map(d => ({ time: Math.floor(new Date(d.date).getTime() / 1000), value: d.total_net_inflow / 1e6 }))
  const last5 = summary.slice(-5).reduce((s, d) => s + d.total_net_inflow, 0)

  return (
    <div className="fade-in">
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${tab === 'indices' ? 'active' : ''}`} onClick={() => setTab('indices')}>SSI Indices</button>
        <button className={`tab ${tab === 'etf' ? 'active' : ''}`} onClick={() => setTab('etf')}>Crypto ETFs</button>
      </div>

      {tab === 'indices' && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            {indices.map((idx, i) => (
              <div key={idx.ticker} className={`card fade-in stagger-${i + 1}`} style={{ cursor: 'pointer', borderColor: selectedIndex === idx.ticker ? 'var(--accent-cyan)' : undefined }} onClick={() => setSelectedIndex(idx.ticker)}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{idx.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{idx.description}</div>
                  </div>
                  <div className={`card-change ${idx.snap.change_pct_24h >= 0 ? 'positive' : 'negative'}`}>{pctStr(idx.snap.change_pct_24h)}</div>
                </div>
                <div className="card-value" style={{ fontSize: 24 }}>${idx.snap.price.toFixed(2)}</div>
                <div className="fine-print" style={{ marginBottom: 0 }}>7d {pctStr(idx.snap.roi_7d)} · 1M {pctStr(idx.snap.roi_1m)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="card fade-in stagger-3">
              <div className="card-title" style={{ marginBottom: 4 }}>📈 {selected?.name} returns</div>
              <div className="fine-print" style={{ marginTop: 0, marginBottom: 12 }}>From the SoSoValue index snapshot. Daily index history is not available on this API tier, so returns are shown by period.</div>
              {selected ? <RoiBars snap={selected.snap} /> : <div className="loading-row"><div className="loading-spinner" /> Loading…</div>}
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
          <div className="tabs" style={{ marginBottom: 16 }}>
            {['BTC', 'ETH', 'SOL', 'XRP'].map(sym => (
              <button key={sym} className={`tab ${etfSymbol === sym ? 'active' : ''}`} onClick={() => setEtfSymbol(sym)}>US spot {sym} ETFs</button>
            ))}
          </div>
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            <div className="card fade-in stagger-1">
              <div className="card-title">💼 Total net assets</div>
              <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{latest ? formatBig(latest.total_net_assets) : '…'}</div>
              <div className="fine-print" style={{ marginBottom: 0 }}>All US spot {etfSymbol} ETFs · {latest?.date || ''}</div>
            </div>
            <div className="card fade-in stagger-2">
              <div className="card-title">📥 Daily net flow</div>
              <div className="card-value" style={{ color: (latest?.total_net_inflow ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {latest ? `${latest.total_net_inflow >= 0 ? '+' : ''}${formatBig(latest.total_net_inflow)}` : '…'}
              </div>
              <div className="fine-print" style={{ marginBottom: 0 }}>Last 5 days: {summary.length ? `${last5 >= 0 ? '+' : ''}${formatBig(last5)}` : '—'}</div>
            </div>
            <div className="card fade-in stagger-3">
              <div className="card-title">🏛️ ETFs listed</div>
              <div className="card-value" style={{ color: 'var(--accent-purple)' }}>{etfs.length || '…'}</div>
              <div className="fine-print" style={{ marginBottom: 0 }}>Cumulative net inflow {latest ? formatBig(latest.cum_net_inflow) : '—'}</div>
            </div>
          </div>

          <div className="chart-container fade-in stagger-4" style={{ marginBottom: 24 }}>
            <div className="chart-header">
              <div className="chart-title">📊 Daily net flow, all US spot {etfSymbol} ETFs ($M)</div>
            </div>
            {flowSeries.length ? <MiniChart data={flowSeries} color={last5 >= 0 ? '#10b981' : '#ef4444'} /> : <div className="loading-row"><div className="loading-spinner" /> Loading…</div>}
          </div>

          <div className="card fade-in stagger-5">
            <div className="card-title" style={{ marginBottom: 16 }}>📋 ETFs by net assets</div>
            <table className="data-table">
              <thead>
                <tr><th>Ticker</th><th>Name</th><th>Net assets</th><th>Daily flow</th><th>Value traded</th><th>Price</th><th>Fee</th><th>As of</th></tr>
              </thead>
              <tbody>
                {etfs.map(etf => (
                  <tr key={etf.ticker}>
                    <td style={{ fontWeight: 600 }}>{etf.ticker}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{etf.name}</td>
                    <td>{formatBig(etf.aum)}</td>
                    <td className={(etf.flow_1d ?? 0) >= 0 ? 'positive' : 'negative'}>{etf.flow_1d == null ? '—' : `${etf.flow_1d >= 0 ? '+' : ''}${formatBig(etf.flow_1d)}`}</td>
                    <td>{formatBig(etf.traded)}</td>
                    <td>{etf.price == null ? '—' : `$${etf.price.toFixed(2)}`}</td>
                    <td>{etf.fee == null ? '—' : `${(etf.fee * 100).toFixed(2)}%`}</td>
                    <td className="muted">{etf.date || '—'}</td>
                  </tr>
                ))}
                {etfs.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading ETFs…</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
