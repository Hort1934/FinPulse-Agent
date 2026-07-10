import { useState, useEffect } from 'react'
import { getMacroEvents } from '../services/api'

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
  const [filter, setFilter] = useState('upcoming')
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
              date: e.date || new Date().toISOString(),
              title: title,
              importance: 'medium', // Default to medium as api does not provide it
              country: 'USA'
            }))
          }
          // Fallback if the structure is flat
          return {
            date: e.date || e.time || new Date().toISOString(),
            title: e.title || e.event_name || 'Unknown Event',
            importance: (e.impact || e.importance || 'medium').toLowerCase(),
            country: e.country || 'USA',
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

  const filtered = filter === 'all' ? events : events.filter(e => e.importance === filter)

  const upcoming = events.filter(e => new Date(e.date) >= new Date())
  const highImpact = events.filter(e => e.importance === 'high')

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">📅 Upcoming Events</div>
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{upcoming.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Next 7 days</div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">🔴 High Impact</div>
          <div className="card-value" style={{ color: 'var(--accent-red)' }}>{highImpact.length}</div>
          <div className="badge badge-red" style={{ marginTop: 8 }}>Market Moving</div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">⏰ Next Event</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)', fontSize: 20 }}>
            {events[0]?.name?.substring(0, 15)}...
          </div>
          <div className="badge badge-yellow" style={{ marginTop: 8 }}>{daysUntil(events[0]?.date)}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Events</button>
        <button className={`tab ${filter === 'high' ? 'active' : ''}`} onClick={() => setFilter('high')}>🔴 High</button>
        <button className={`tab ${filter === 'medium' ? 'active' : ''}`} onClick={() => setFilter('medium')}>🟡 Medium</button>
        <button className={`tab ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>🟢 Low</button>
      </div>

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
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{event.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                  <span className="badge badge-purple">{event.category}</span>
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
        <div className="card-title" style={{ marginBottom: 12 }}>📖 Impact Guide</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance high" /> <span style={{ fontWeight: 600 }}>High Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>CPI, Interest Rates, GDP — expect significant crypto volatility</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance medium" /> <span style={{ fontWeight: 600 }}>Medium Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>PPI, Retail Sales — moderate market influence</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="event-importance low" /> <span style={{ fontWeight: 600 }}>Low Impact</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>Jobless Claims, minor reports — limited direct effect</span>
          </div>
        </div>
      </div>
    </div>
  )
}
