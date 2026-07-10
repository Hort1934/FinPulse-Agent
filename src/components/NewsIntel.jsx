import { useState, useEffect } from 'react'
import { getNewsFeed, getHotNews } from '../services/api'

const CATEGORIES = [
  { id: 0, label: 'All', color: '--accent-cyan' },
  { id: 1, label: 'News', color: '--accent-blue' },
  { id: 2, label: 'Research', color: '--accent-purple' },
  { id: 3, label: 'Institutional', color: '--accent-yellow' },
  { id: 4, label: 'Insights', color: '--accent-cyan' },
  { id: 7, label: 'Official', color: '--accent-green' },
]

const CATEGORY_NAMES = { 1: 'news', 2: 'research', 3: 'institution', 4: 'insights', 7: 'announcement', 13: 'news' }

const BULLISH_KEYWORDS = ['surge', 'rally', 'bullish', 'growth', 'record', 'high', 'approve', 'adopt', 'milestone', 'inflow', 'accumulate', 'pump', 'breakout', 'explosive']
const BEARISH_KEYWORDS = ['crash', 'dump', 'bearish', 'decline', 'warning', 'risk', 'sell', 'outflow', 'hack', 'exploit', 'ban', 'lawsuit', 'fear']

function analyzeSentiment(title, content = '') {
  const text = `${title} ${content}`.toLowerCase()
  let bullScore = 0, bearScore = 0
  BULLISH_KEYWORDS.forEach(kw => { if (text.includes(kw)) bullScore++ })
  BEARISH_KEYWORDS.forEach(kw => { if (text.includes(kw)) bearScore++ })
  if (bullScore > bearScore) return 'bullish'
  if (bearScore > bullScore) return 'bearish'
  return 'neutral'
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NewsIntel() {
  const [news, setNews] = useState([])
  const [activeCategory, setActiveCategory] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = activeCategory > 0 ? { category: activeCategory } : {}
      const data = await getNewsFeed(params)
      if (data?.list) {
        setNews(data.list.map(n => ({ ...n, sentiment: analyzeSentiment(n.title, n.content) })))
      }
      setLoading(false)
    }
    load()
  }, [activeCategory])

  const filtered = activeCategory === 0 ? news : news.filter(n => n.category === activeCategory)

  // Generate tag cloud
  const tagCounts = {}
  news.forEach(n => {
    (n.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)

  const sentimentStats = {
    bullish: news.filter(n => n.sentiment === 'bullish').length,
    bearish: news.filter(n => n.sentiment === 'bearish').length,
    neutral: news.filter(n => n.sentiment === 'neutral').length,
  }

  return (
    <div className="fade-in">
      {/* Sentiment Overview */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">🟢 Bullish Signals</div>
          <div className="card-value" style={{ color: 'var(--accent-green)' }}>{sentimentStats.bullish}</div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(sentimentStats.bullish / news.length) * 100}%`, background: 'var(--accent-green)', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">🔴 Bearish Signals</div>
          <div className="card-value" style={{ color: 'var(--accent-red)' }}>{sentimentStats.bearish}</div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(sentimentStats.bearish / news.length) * 100}%`, background: 'var(--accent-red)', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">⚪ Neutral</div>
          <div className="card-value" style={{ color: 'var(--text-tertiary)' }}>{sentimentStats.neutral}</div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(sentimentStats.neutral / news.length) * 100}%`, background: 'var(--text-muted)', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ gridTemplateColumns: '1fr 300px' }}>
        {/* News Feed */}
        <div>
          {/* Category Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} className={`tab ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
              ))
            ) : (
              filtered.map((item, i) => (
                <div key={item.id} className={`news-card fade-in stagger-${Math.min(i + 1, 6)}`} onClick={() => item.original_link && window.open(item.original_link, '_blank')}>
                  <div className="news-meta">
                    <span className={`news-category ${CATEGORY_NAMES[item.category] || 'news'}`}>
                      {CATEGORY_NAMES[item.category] || 'News'}
                    </span>
                    <span className={`sentiment-badge ${item.sentiment || analyzeSentiment(item.title)}`}>
                      {item.sentiment === 'bullish' ? '🟢' : item.sentiment === 'bearish' ? '🔴' : '⚪'}
                      {item.sentiment || analyzeSentiment(item.title)}
                    </span>
                    <span>{timeAgo(item.release_time)}</span>
                    {item.author && <span>• {item.author}</span>}
                  </div>
                  <div className="news-title">{item.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="news-tags">
                      {(item.matched_currencies || []).map(c => (
                        <span key={c.name} className="badge badge-cyan">{c.name}</span>
                      ))}
                      {(item.tags || []).slice(0, 3).map(t => (
                        <span key={t} className="news-tag">{t}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.like_count > 0 && <span>❤️ {item.like_count}</span>}
                      {item.impression_count > 0 && <span>👁️ {(item.impression_count / 1000).toFixed(1)}K</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tag Cloud Sidebar */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>🏷️ Trending Topics</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topTags.map(([tag, count]) => (
                <span key={tag} className="stat-pill" style={{ fontSize: 11, padding: '4px 10px' }}>
                  {tag} <span className="stat-value">{count}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>📊 Sentiment Distribution</div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${(sentimentStats.bullish / news.length) * 100}%`, background: 'var(--accent-green)', transition: 'width 0.5s ease' }} />
              <div style={{ width: `${(sentimentStats.neutral / news.length) * 100}%`, background: 'var(--text-muted)', transition: 'width 0.5s ease' }} />
              <div style={{ width: `${(sentimentStats.bearish / news.length) * 100}%`, background: 'var(--accent-red)', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ color: 'var(--accent-green)' }}>Bullish {Math.round((sentimentStats.bullish / news.length) * 100)}%</span>
              <span>Neutral {Math.round((sentimentStats.neutral / news.length) * 100)}%</span>
              <span style={{ color: 'var(--accent-red)' }}>Bearish {Math.round((sentimentStats.bearish / news.length) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
