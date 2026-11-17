import { useState, useEffect } from 'react'
import { getMacroEvents } from '../services/api'
import { impactOf, IMPACT_RULES } from '../../shared/lexicon.js'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return { day: d.getDate(), month: d.toLocaleDateString('en', { month: 'short' }), weekday: d.toLocaleDateString('en', { weekday: 'short' }) }
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  const days = Math.ceil(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${Math.abs(days)}d ago`
  return `In ${days}d`
}

export default function MacroRadar() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await getMacroEvents()
      if (data) {
        const eventsArray = Array.isArray(data) ? data : (data.list || data.data || [])
        // Map the correct data structure: { date: '...', events: ['...'] }
        const mappedEvents = eventsArray.flatMap(e => {
          if (Array.isArray(e.events)) {
            return e.events.map(title => ({
              date: e.date,
              title: title.trim(),
              importance: impactOf(title),
            }))
          }
          // Fallback if the structure is flat
          return {
            date: e.date || e.time || new Date().toISOString(),
            title: e.title || e.event_name || 'Unknown Event',
            importance: impactOf(e.title || e.event_name || ''),
            previous: e.previous,
            forecast: e.forecast,
            actual: e.actual
          }
        })
        setEvents(mappedEvents)
      }
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const next = upcoming.find(e => e.importance === 'high') || upcoming[0]
  const highImpact = upcoming.filter(e => e.importance === 'high')

  const base = upcoming.length ? upcoming : events
  const filtered = filter === 'all' ? base : base.filter(e => e.importance === filter)

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">📅 Upcoming Events</div>
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{upcoming.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>From today in the SoSoValue calendar</div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">🔴 High Impact</div>
          <div className="card-value" style={{ color: 'var(--accent-red)' }}>{highImpact.length}</div>
          <div className="badge badge-red" style={{ marginTop: 8 }}>Upcoming · CPI, PCE, Fed, GDP, payrolls</div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">⏰ {next?.importance === 'high' ? 'Next high-impact event' : 'Next event'}</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)', fontSize: 20 }}>
            {next?.title || 'None scheduled'}
          </div>
          <div className="badge badge-yellow" style={{ marginTop: 8 }}>{next ? daysUntil(next.date) : '—'}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Events</button>
        <button className={`tab ${filter === 'high' ? 'active' : ''}`} onClick={() => setFilter('high')}>🔴 High</button>
        <button className={`tab ${filter === 'medium' ? 'active' : ''}`} onClick={() => setFilter('medium')}>🟡 Medium</button>
        <button className={`tab ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>🟢 Low</button>
      </div>

      {loading && <div className="loading-row"><div className="loading-spinner" /> Loading the SoSoValue macro calendar…</div>}
      {!loading && filtered.length === 0 && <div className="card">No {filter === 'all' ? '' : `${filter}-impact `}events in the calendar.</div>}

      {/* Events Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((event, i) => {
          const { day, month, weekday } = formatDate(event.date)
          return (
            <div key={i} className={`event-card fade-in stagger-${Math.min(i + 1, 6)}`}>
              <div className="event-date">
                <div className="day">{day}</div>
                <div className="month">{month}</div>
              </div>
              <div className={`event-importance ${event.importance}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{event.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{weekday}</span>
                  {event.previous && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      Prev: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{event.previous}</span>
                    </span>
                  )}
                  {event.forecast && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      Forecast: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{event.forecast}</span>
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`badge ${event.importance === 'high' ? 'badge-red' : event.importance === 'medium' ? 'badge-yellow' : 'badge-green'}`}>
                  {event.importance}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{daysUntil(event.date)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Impact Legend */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>📖 Impact Guide</div>
        <div className="fine-print" style={{ marginTop: 0, marginBottom: 12 }}>SoSoValue lists event names and dates only. Impact is classified by FinPulse with the rules below (shared with the score engine).</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance high" /> <span style={{ fontWeight: 600 }}>High Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{IMPACT_RULES.high}. FinPulse cuts signal confidence when one is ≤ 1 day away.</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance medium" /> <span style={{ fontWeight: 600 }}>Medium Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{IMPACT_RULES.medium}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance low" /> <span style={{ fontWeight: 600 }}>Low Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{IMPACT_RULES.low}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
