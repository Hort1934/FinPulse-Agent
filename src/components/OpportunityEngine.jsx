import { useState, useEffect, useCallback } from 'react'
import SodexTradeModal from './SodexTradeModal'
import { getSignals, getFundraisingProjects, getFundraisingProjectDetails } from '../services/api'

const COMPONENT_LABELS = {
  etfFlow: 'ETF net flow',
  momentum: 'Momentum',
  trend: 'Trend regime',
  participation: 'Participation',
  sector: 'Sector',
  news: 'News tone',
}

const pct = (x, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`)
const signed = x => (x > 0 ? `+${x}` : `${x}`)
const scoreColor = s => (s == null ? 'var(--text-muted)' : s >= 25 ? 'var(--accent-green)' : s <= -25 ? 'var(--accent-red)' : 'var(--accent-yellow)')

function ComponentBar({ name, c }) {
  const v = c.value
  return (
    <div className="cbar">
      <div className="cbar-head">
        <span>{COMPONENT_LABELS[name] || name} <span className="cbar-w">w{c.weight}</span></span>
        <span className="cbar-v" style={{ color: v == null ? 'var(--text-muted)' : v >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {v == null ? 'n/a' : (v > 0 ? '+' : '') + v.toFixed(2)}
        </span>
      </div>
      <div className="cbar-track">
        <div className="cbar-mid" />
        {v != null && (
          <div className="cbar-fill" style={{
            left: v >= 0 ? '50%' : `${50 + v * 50}%`,
            width: `${Math.abs(v) * 50}%`,
            background: v >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }} />
        )}
      </div>
      <div className="cbar-detail">{c.detail}</div>
    </div>
  )
}

function ScoreCard({ a, onTrade }) {
  const [open, setOpen] = useState(false)
  const color = scoreColor(a.score)
  return (
    <div className="score-card fade-in">
      <div className="score-card-top">
        <div>
          <div className="score-sym">{a.symbol} <span>{a.name}</span></div>
          <div className="score-price">
            ${a.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}
            <span className={`card-change ${a.change24h >= 0 ? 'positive' : 'negative'}`}>{a.change24h >= 0 ? '+' : ''}{pct(a.change24h, 2)}</span>
          </div>
        </div>
        <div className="score-big" style={{ color }}>
          <div className="score-num">{a.score == null ? '—' : signed(a.score)}</div>
          <div className="score-stance" style={{ borderColor: color }}>{a.stance}</div>
        </div>
      </div>

      <div className="score-meta">
        <span title="Data coverage × component agreement × macro risk">Confidence <b>{a.confidence}%</b></span>
        <span>Coverage <b>{pct(a.coverage)}</b></span>
        {a.eventRisk !== 'low' && <span className={`badge ${a.eventRisk === 'high' ? 'badge-red' : 'badge-yellow'}`}>Macro risk {a.eventRisk}</span>}
      </div>

      <div className="cbar-list">
        {Object.entries(a.components).map(([k, c]) => <ComponentBar key={k} name={k} c={c} />)}
      </div>

      {a.components.news?.headlines?.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'} news behind the tone</button>
          {open && (
            <ul className="score-news">
              {a.components.news.headlines.map(h => (
                <li key={h.link}><span className={`badge ${h.tone === 'bullish' ? 'badge-green' : h.tone === 'bearish' ? 'badge-red' : 'badge-cyan'}`}>{h.tone}</span> <a href={h.link} target="_blank" rel="noreferrer">{h.title}</a></li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="score-actions">
        <span className="score-market">SoDEX market: <code>{a.sodexSymbol}</code></span>
        <button className="btn btn-sm btn-outline trade-btn" onClick={() => onTrade(a)}>⚡ Trade ticket</button>
      </div>
    </div>
  )
}

function Methodology({ m }) {
  return (
    <details className="method-box">
      <summary>How the FinPulse Score works</summary>
      <p>Each component is normalised to [−1, +1] from SoSoValue data; the score is the weighted mean × 100. Missing components are dropped and lower the coverage. <b>|score| ≥ {m.threshold}</b> is a directional call; anything inside is NEUTRAL. The AI agent explains this number but never produces it.</p>
      <table className="method-table">
        <tbody>
          <tr><td>ETF net flow</td><td>w{m.weights.etfFlow}</td><td>tanh(5-day average US spot-ETF net flow ÷ σ of daily flows)</td></tr>
          <tr><td>Momentum</td><td>w{m.weights.momentum}</td><td>Volatility-adjusted 1d/7d/30d log returns (t-stat blend)</td></tr>
          <tr><td>Trend regime</td><td>w{m.weights.trend}</td><td>SMA20 vs SMA50, scaled by daily volatility</td></tr>
          <tr><td>Participation</td><td>w{m.weights.participation}</td><td>Last volume ÷ 20-day average, signed by the day's direction</td></tr>
          <tr><td>Sector</td><td>w{m.weights.sector}</td><td>24h change of the asset's SoSoValue sector</td></tr>
          <tr><td>News tone</td><td>w{m.weights.news}</td><td>Bullish vs bearish term count in SoSoValue hot news mentioning the asset</td></tr>
          <tr><td>Confidence</td><td></td><td>coverage × component agreement × macro haircut (high-impact event ≤ 1 day: ×0.75)</td></tr>
        </tbody>
      </table>
    </details>
  )
}

function TrackRecord({ data }) {
  const bt = data.backtest
  const lg = data.ledger
  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>Walk-forward backtest · {bt.from} → {bt.to}</div>
        <table className="data-table">
          <thead><tr><th>Horizon</th><th>Signals</th><th>Long / Short</th><th>Hit rate</th><th>Naive (same mix)</th><th>Edge</th><th>Avg signed return</th></tr></thead>
          <tbody>
            {bt.horizons.map(h => (
              <tr key={h.horizonDays}>
                <td>{h.horizonDays}d</td>
                <td>{h.signals}</td>
                <td>{h.longs} / {h.shorts}</td>
                <td><b>{pct(h.hitRate, 1)}</b></td>
                <td>{pct(h.naiveHitRate, 1)}</td>
                <td style={{ color: h.edge > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{h.edge == null ? '—' : `${h.edge > 0 ? '+' : ''}${(h.edge * 100).toFixed(1)} pp`}</td>
                <td>{pct(h.avgSignedReturn, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine-print">Components used: {bt.componentsUsed.join(', ')}. {bt.note}</p>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Live signal ledger (forward test)</div>
        <div className="ledger-stats">
          {lg.stats.map(s => (
            <div key={s.horizonHours} className="stat-pill">
              {s.horizonHours}h: <span className="stat-value">{s.graded ? pct(s.hitRate) : '—'}</span> · {s.graded} graded · {s.pending} pending
            </div>
          ))}
        </div>
        <p className="fine-print">Every score is stored with its price at issue (at most once per asset per 6h, or when the stance flips) and graded against the live price after 24h / 72h / 7d. Recording started {lg.since ? new Date(lg.since).toLocaleString() : 'now'}.</p>
        <table className="data-table">
          <thead><tr><th>Issued</th><th>Asset</th><th>Score</th><th>Stance</th><th>Price</th><th>24h</th><th>72h</th><th>7d</th></tr></thead>
          <tbody>
            {lg.recent.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.ts).toLocaleString()}</td>
                <td>{e.symbol}</td>
                <td style={{ color: scoreColor(e.score) }}>{signed(e.score)}</td>
                <td>{e.stance}</td>
                <td>${e.price.toLocaleString()}</td>
                {[24, 72, 168].map(h => {
                  const o = e.outcomes[h]
                  return <td key={h}>{o ? <span style={{ color: o.hit == null ? 'inherit' : o.hit ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pct(o.ret, 1)} {o.hit == null ? '' : o.hit ? '✓' : '✗'}</span> : <span className="muted">pending</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Fundraising() {
  const [fundraising, setFundraising] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const funds = await getFundraisingProjects()
        const fundsArray = Array.isArray(funds) ? funds : (funds?.list || funds?.data || [])
        const recent = fundsArray.slice(-8).reverse()
        const out = []
        for (const proj of recent) {
          try {
            const details = await getFundraisingProjectDetails(proj.project_id)
            const d = details?.data || details
            const rounds = d?.fundraising_rounds || []
            if (!rounds.length) continue
            const r = rounds[rounds.length - 1]
            const amount = parseFloat(r.amount) || 0
            out.push({
              name: proj.project_name || proj.name,
              amountDisplay: amount > 0 ? `$${amount.toFixed(1)}M` : 'Undisclosed',
              date: r.timestamp ? new Date(parseInt(r.timestamp)).toLocaleDateString() : '-',
              investors: r.investors ? r.investors.map(i => i.name).slice(0, 3) : [],
              sector: d.sector || 'Crypto',
              round: r.round || 'Round',
            })
          } catch { /* skip project */ }
        }
        if (alive) setFundraising(out)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  return (
    <>
      <div className="section-hint">💰 Recent crypto project fundraising rounds — SoSoValue data</div>
      {loading && <div className="loading-row"><div className="loading-spinner" /> Loading rounds…</div>}
      <div className="grid grid-2">
        {fundraising.map((p, i) => (
          <div key={p.name} className={`card fade-in stagger-${Math.min(i + 1, 6)}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                <div className="badge badge-purple" style={{ marginTop: 4 }}>{p.sector}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{p.amountDisplay}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.round}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.investors.map(inv => <span key={inv} className="stat-pill" style={{ fontSize: 10 }}>{inv}</span>)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>📅 {p.date}</div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function OpportunityEngine() {
  const [tab, setTab] = useState('scores')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tradeAsset, setTradeAsset] = useState(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError(null)
    try { setData(await getSignals({ refresh })) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="fade-in">
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${tab === 'scores' ? 'active' : ''}`} onClick={() => setTab('scores')}>⚡ Scores</button>
        <button className={`tab ${tab === 'track' ? 'active' : ''}`} onClick={() => setTab('track')}>🎯 Track record</button>
        <button className={`tab ${tab === 'fundraising' ? 'active' : ''}`} onClick={() => setTab('fundraising')}>💰 Fundraising</button>
      </div>

      {tab !== 'fundraising' && (
        <div className="desk-toolbar">
          <div>
            {data && <>Scored {new Date(data.generatedAt).toLocaleTimeString()} from {data.sources.length} SoSoValue calls · macro risk <b className={`risk-${data.macro.level}`}>{data.macro.level}</b>
              {data.macro.upcoming.slice(0, 2).map(e => <span key={e.date + e.name} className="stat-pill macro-pill">{e.daysAway === 0 ? 'Today' : `+${e.daysAway}d`} · {e.name}</span>)}</>}
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => load(true)} disabled={loading}>{loading ? 'Scoring…' : '↻ Re-score'}</button>
        </div>
      )}

      {error && tab !== 'fundraising' && <div className="error-box">Signals unavailable: {error}. FinPulse never substitutes simulated data for scores.</div>}
      {loading && !data && tab !== 'fundraising' && <div className="loading-row"><div className="loading-spinner" /> Pulling SoSoValue data and scoring 5 assets…</div>}

      {tab === 'scores' && data && (
        <>
          <Methodology m={data.methodology} />
          <div className="grid grid-2">
            {data.assets.map(a => <ScoreCard key={a.symbol} a={a} onTrade={setTradeAsset} />)}
          </div>
        </>
      )}
      {tab === 'track' && data && <TrackRecord data={data} />}
      {tab === 'fundraising' && <Fundraising />}

      <SodexTradeModal isOpen={!!tradeAsset} onClose={() => setTradeAsset(null)} asset={tradeAsset} />
    </div>
  )
}
