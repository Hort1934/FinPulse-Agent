import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/api'

const SUGGESTIONS = [
  "Why is BTC's FinPulse Score where it is?",
  "Which asset has the strongest signal and why?",
  "What are ETF flows telling us this week?",
  "Any macro events that should stop me trading?",
  "How reliable have the signals been?",
]

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default function AgentChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 **FinPulse AI analyst**\n\nI answer from the desk's live data: FinPulse Scores and their components (ETF flows, momentum, trend, participation, sector, news), the macro calendar and the signals' track record — all from SoSoValue.\n\nIf the data doesn't cover your question, I'll say so instead of guessing."
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const history = newMessages.filter(m => !m.error && m !== messages[0]).slice(-10)
    const r = await sendChatMessage(history.map(({ role, content }) => ({ role, content })))
    setMessages(prev => [...prev, r.error
      ? { role: 'assistant', error: true, content: `⚠️ **AI unavailable:** ${r.error}` }
      : { role: 'assistant', content: r.response, dataAsOf: r.dataAsOf }])
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const renderMarkdown = (text) => {
    // Escape first: model output must never be able to inject HTML.
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(34,211,238,0.1);padding:1px 4px;border-radius:3px;font-family:var(--font-mono);font-size:12px">$1</code>')
      .replace(/\n/g, '<br/>')
      .replace(/• /g, '&bull; ')
  }

  return (
    <div className="fade-in">
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="chat-avatar">
                {msg.role === 'assistant' ? '🧠' : '👤'}
              </div>
              <div className={`chat-bubble ${msg.error ? 'chat-error' : ''}`}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                {msg.dataAsOf && <div className="chat-source">Grounded in SoSoValue data as of {new Date(msg.dataAsOf).toLocaleTimeString()}</div>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <div className="chat-avatar">🧠</div>
              <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="loading-spinner" />
                <span style={{ color: 'var(--text-tertiary)' }}>Analyzing markets...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} className="stat-pill" onClick={() => handleSend(s)} style={{ cursor: 'pointer', transition: 'all var(--transition-fast)', fontSize: 11 }}
                onMouseEnter={(e) => { e.target.style.background = 'var(--accent-cyan-dim)'; e.target.style.borderColor = 'var(--accent-cyan)' }}
                onMouseLeave={(e) => { e.target.style.background = ''; e.target.style.borderColor = '' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-area">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about crypto markets, news, ETFs, treasuries..."
            disabled={loading}
            id="chat-input"
          />
          <button className="chat-send-btn" onClick={() => handleSend()} disabled={loading || !input.trim()} id="chat-send">
            {loading ? '⏳' : '→'} Send
          </button>
        </div>
      </div>
    </div>
  )
}
