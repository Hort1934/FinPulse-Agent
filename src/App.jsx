import { useState } from 'react'
import MarketPulse from './components/MarketPulse'
import NewsIntel from './components/NewsIntel'
import IndexHub from './components/IndexHub'
import TreasuryMonitor from './components/TreasuryMonitor'
import MacroRadar from './components/MacroRadar'
import AgentChat from './components/AgentChat'
import OpportunityEngine from './components/OpportunityEngine'
import AiAlertBanner from './components/AiAlertBanner'
import PortfolioTracker from './components/PortfolioTracker'

const NAV_ITEMS = [
  { id: 'pulse', icon: '⚡', label: 'Market Pulse', section: 'Intelligence' },
  { id: 'news', icon: '📰', label: 'News Intel', section: 'Intelligence' },
  { id: 'portfolio', icon: '💼', label: 'My Portfolio', section: 'Analytics' },
  { id: 'index', icon: '📊', label: 'Index & ETF', section: 'Analytics' },
  { id: 'treasury', icon: '🏦', label: 'BTC Treasury', section: 'Analytics' },
  { id: 'macro', icon: '🌍', label: 'Macro Radar', section: 'Analytics' },
  { id: 'opportunities', icon: '🔍', label: 'Opportunities', section: 'Discovery' },
  { id: 'chat', icon: '🤖', label: 'AI Agent', section: 'Agent' },
]

function App() {
  const [activeView, setActiveView] = useState('pulse')

  const grouped = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const renderView = () => {
    switch (activeView) {
      case 'pulse': return <MarketPulse />
      case 'news': return <NewsIntel />
      case 'portfolio': return <PortfolioTracker />
      case 'index': return <IndexHub />
      case 'treasury': return <TreasuryMonitor />
      case 'macro': return <MacroRadar />
      case 'opportunities': return <OpportunityEngine />
      case 'chat': return <AgentChat />
      default: return <MarketPulse />
    }
  }

  const activeItem = NAV_ITEMS.find(n => n.id === activeView)

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">F</div>
            <div>
              <div className="logo-text">FinPulse</div>
              <div className="logo-sub">Agent Terminal</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              <div className="nav-section-title">{section}</div>
              {items.map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setActiveView(item.id)}
                  role="button"
                  tabIndex={0}
                  id={`nav-${item.id}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="powered-by">
            Powered by <span>SoSoValue</span> API
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="page-title">
            <span>{activeItem?.icon}</span>
            <span>{activeItem?.label}</span>
            <div className="pulse-dot" style={{ marginLeft: 8 }}></div>
          </div>
          <div className="page-subtitle">
            {activeView === 'pulse' && 'Real-time market overview & sector analysis'}
            {activeView === 'news' && 'AI-powered news feed with sentiment analysis'}
            {activeView === 'portfolio' && 'Track your custom crypto portfolio performance'}
            {activeView === 'index' && 'SoSoValue indices & crypto ETF analytics'}
            {activeView === 'treasury' && 'Corporate Bitcoin holdings tracker'}
            {activeView === 'macro' && 'Macroeconomic events & crypto impact'}
            {activeView === 'opportunities' && 'Signal generation & opportunity discovery'}
            {activeView === 'chat' && 'Conversational AI market analyst'}
          </div>
        </header>

        <AiAlertBanner />

        <div className="page-content">
          {renderView()}
        </div>
      </main>
    </div>
  )
}

export default App
