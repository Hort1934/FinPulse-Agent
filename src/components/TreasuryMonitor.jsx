import { useState, useEffect } from 'react'
import { getBTCTreasuries, getBTCPurchaseHistory, getMarketSnapshot } from '../services/api'

function formatBig(num) {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toLocaleString()}`
}

export default function TreasuryMonitor() {
  const [treasuries, setTreasuries] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)

  useEffect(() => {
    async function load() {
      // 1. Fetch current BTC price
      let btcPrice = 90000; // fallback if API fails
      try {
        const btcSnap = await getMarketSnapshot('bitcoin');
        if (btcSnap && btcSnap.price) {
          btcPrice = btcSnap.price;
        } else if (btcSnap && btcSnap.data && btcSnap.data.price) {
          btcPrice = btcSnap.data.price;
        }
      } catch(e) {}

      // 2. Fetch list of treasuries
      const data = await getBTCTreasuries()
      if (data && data.code === undefined) {
        const treasuryArray = Array.isArray(data) ? data : (data.list || data.data || [])
        
        let currentTreasuries = treasuryArray.map(t => ({
          company: t.name || t.company_name || 'Unknown',
          ticker: t.ticker || t.symbol || 'N/A',
          btcHeld: 0,
          valueUsd: 0,
          percentOfSupply: 0,
          avgCost: 0,
          rank: 0,
          lastPurchase: '-'
        }));
        
        // Show placeholders immediately
        setTreasuries(currentTreasuries);

        // Fetch details in small chunks to avoid rate limiting
        const chunkSize = 5;
        for (let i = 0; i < currentTreasuries.length; i += chunkSize) {
          const chunk = currentTreasuries.slice(i, i + chunkSize);
          
          await Promise.all(chunk.map(async (t) => {
            try {
              let hist = await getBTCPurchaseHistory(t.ticker);
              if (hist && hist.code === undefined) {
                const histArray = Array.isArray(hist) ? hist : (hist.data || []);
                if (histArray.length > 0) {
                  const latest = histArray[0];
                  const btcHeld = parseFloat(latest.btc_holding) || 0;
                  t.btcHeld = btcHeld;
                  t.valueUsd = btcHeld * btcPrice;
                  t.percentOfSupply = Number(((btcHeld / 21000000) * 100).toFixed(4));
                  t.lastPurchase = latest.date || '-';
                }
              }
            } catch (err) {}
          }));

          // Update state and sort by holding
          currentTreasuries = [...currentTreasuries].sort((a, b) => b.btcHeld - a.btcHeld).map((t, idx) => ({...t, rank: idx + 1}));
          setTreasuries([...currentTreasuries]);
          
          // Wait 600ms between chunks
          await new Promise(r => setTimeout(r, 600));
        }
      }
    }
    load()
  }, [])

  const totalBTC = treasuries.reduce((s, t) => s + (t.btcHeld || 0), 0)
  const totalValue = treasuries.reduce((s, t) => s + (t.valueUsd || 0), 0)
  const totalSupplyPct = treasuries.reduce((s, t) => s + (t.percentOfSupply || 0), 0)

  return (
    <div className="fade-in">
      {/* Summary Stats */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">₿ Total BTC Held</div>
          <div className="card-value" style={{ color: 'var(--accent-yellow)' }}>{totalBTC.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{totalSupplyPct.toFixed(2)}% of total supply</div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">💰 Total Value</div>
          <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>{formatBig(totalValue)}</div>
          <div className="card-change positive" style={{ marginTop: 8 }}>▲ Market Value at Current Price</div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏢 Companies Tracked</div>
          <div className="card-value" style={{ color: 'var(--accent-purple)' }}>{treasuries.length}</div>
          <div className="badge badge-green" style={{ marginTop: 8 }}>Publicly Listed</div>
        </div>
      </div>

      {/* Holdings Visualization */}
      <div className="card fade-in stagger-4" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>📊 Holdings Distribution</div>
        <div style={{ display: 'flex', gap: 4, height: 40, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {treasuries.map((t, i) => {
            const colors = ['#22d3ee', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444']
            const width = (t.btcHeld / totalBTC) * 100
            return (
              <div
                key={t.ticker}
                style={{
                  width: `${width}%`,
                  background: colors[i % colors.length],
                  opacity: selectedCompany === t.ticker ? 1 : 0.7,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={() => setSelectedCompany(t.ticker)}
                onMouseLeave={() => setSelectedCompany(null)}
                title={`${t.company}: ${t.btcHeld.toLocaleString()} BTC`}
              >
                {width > 8 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--bg-primary)' }}>
                    {t.ticker}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {treasuries.map((t, i) => {
            const colors = ['#22d3ee', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444']
            return (
              <div key={t.ticker} className="pie-legend-item" style={{ fontSize: 11 }}>
                <div className="pie-legend-dot" style={{ background: colors[i % colors.length] }} />
                <span>{t.company}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Treasury Table */}
      <div className="card fade-in stagger-5">
        <div className="card-header">
          <div className="card-title">🏦 Corporate BTC Treasury Leaderboard</div>
          <div className="badge badge-cyan">Live Data</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Company</th>
              <th>Ticker</th>
              <th>BTC Held</th>
              <th>Value (USD)</th>
              <th>% of Supply</th>
              <th>Last Purchase</th>
            </tr>
          </thead>
          <tbody>
            {treasuries.map((t) => (
              <tr key={t.ticker} style={{ background: selectedCompany === t.ticker ? 'var(--bg-card-hover)' : undefined }}>
                <td className="rank">#{t.rank}</td>
                <td style={{ fontWeight: 600 }}>{t.company}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{t.ticker}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.btcHeld.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatBig(t.valueUsd)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, maxWidth: 80 }}>
                      <div style={{ height: '100%', width: `${Math.min(t.percentOfSupply * 30, 100)}%`, background: 'var(--accent-yellow)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.percentOfSupply}%</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.lastPurchase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
