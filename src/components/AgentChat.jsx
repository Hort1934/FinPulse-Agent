import { useState, useRef, useEffect } from 'react'
import { sendChatMessage, getMarketSnapshot } from '../services/api'

const SUGGESTIONS = [
  "What's the current market sentiment?",
  "Which sectors are pumping today?",
  "Analyze BTC ETF flows this week",
  "What macro events should I watch?",
  "Find tokens near their all-time high",
  "Summarize today's top crypto news",
]

export default function AgentChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 **Welcome to FinPulse AI!**\n\nI'm your personal crypto market analyst powered by SoSoValue data. I can help you with:\n\n• 📊 Market analysis & price movements\n• 📰 News sentiment breakdown\n• 📈 ETF flow analysis\n• 🏦 BTC treasury tracking\n• 🌍 Macro event impact\n• 🔍 Opportunity discovery\n\nAsk me anything about the crypto markets!"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextData, setContextData] = useState('Fetching live market context...')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    async function loadContext() {
      const btc = await getMarketSnapshot('1673723677362319866') // BTC
      const eth = await getMarketSnapshot('1673723677362319867') // ETH
      if (btc && eth) {
        setContextData(`Current top assets: BTC $${btc.price} (${(btc.change_pct_24h * 100).toFixed(2)}%), ETH $${eth.price} (${(eth.change_pct_24h * 100).toFixed(2)}%). Market sentiment: mixed.`)
      }
    }
    loadContext()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContext = () => {
    return contextData
  }

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await sendChatMessage(
        newMessages.filter(m => m.role !== 'system').slice(-10),
        buildContext()
      )
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Connection error. Make sure the backend server is running (`node server/index.js`).'
      }])
    }
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
    // Simple markdown renderer
    return text
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
              <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
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
