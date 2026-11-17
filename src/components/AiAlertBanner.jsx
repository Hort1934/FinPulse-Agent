import { useState, useEffect } from 'react'
import { getSignals } from '../services/api'

// Desk brief: one line computed from the FinPulse Score output. No text is
// generated here, so it can never state something the data does not show.
function buildBrief(s) {
  const scored = s.assets.filter(a => a.score != null)
  if (!scored.length) return null
  const avg = Math.round(scored.reduce((t, a) => t + a.score, 0) / scored.length)
  const counts = scored.reduce((c, a) => ({ ...c, [a.stance]: (c[a.stance] || 0) + 1 }), {})
  const top = [...scored].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0]
  const btc = s.assets.find(a => a.symbol === 'BTC')
  const parts = [
    `Avg FinPulse Score ${avg > 0 ? '+' : ''}${avg}`,
    Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · '),
    `strongest: ${top.symbol} ${top.score > 0 ? '+' : ''}${top.score}`,
  ]
  if (btc?.components.etfFlow?.value != null) parts.push(`BTC ETFs: ${btc.components.etfFlow.detail.split(' vs ')[0]}`)
  const next = s.macro.upcoming[0]
  if (next) parts.push(`next macro: ${next.name} (${next.daysAway === 0 ? 'today' : `in ${next.daysAway}d`})`)
  return { text: parts.join('  ·  '), tone: avg >= 25 ? 'bull' : avg <= -25 ? 'bear' : 'neutral', at: s.generatedAt, risk: s.macro.level }
}

export default function AiAlertBanner({ onOpen }) {
  const [brief, setBrief] = useState(null)
  const [error, setError] = useState(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let alive = true
    getSignals({ record: false })
      .then(s => alive && setBrief(buildBrief(s)))
      .catch(e => alive && setError(e.message))
    return () => { alive = false }
  }, [])

  if (!visible || (!brief && !error)) return null

  const color = error ? 'var(--accent-yellow)' : brief.tone === 'bull' ? 'var(--accent-green)' : brief.tone === 'bear' ? 'var(--accent-red)' : 'var(--accent-cyan)'

  return (
    <div className="desk-brief" style={{ borderColor: color }}>
      <div className="desk-brief-main" onClick={onOpen} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen?.()}>
        <span className="desk-brief-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="desk-brief-label">DESK BRIEF</span>
        <span className="desk-brief-text">
          {error ? `Signals unavailable: ${error}` : brief.text}
        </span>
        {brief && <span className="desk-brief-meta">SoSoValue · {new Date(brief.at).toLocaleTimeString()} · macro risk {brief.risk}</span>}
      </div>
      <button className="desk-brief-close" onClick={() => setVisible(false)} aria-label="Dismiss">✕</button>
    </div>
  )
}
