import { useState, useEffect } from 'react';
import { getMarketSnapshot } from '../services/api';

function formatNumber(num) {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortfolioTracker() {
  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('finpulse_portfolio');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1673723677362319866', symbol: 'BTC', amount: 0.5 },
      { id: '1673723677362319867', symbol: 'ETH', amount: 5.0 },
      { id: '1673723677362319875', symbol: 'SOL', amount: 50.0 }
    ];
  });
  
  const [marketData, setMarketData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('finpulse_portfolio', JSON.stringify(portfolio));
    
    async function fetchPrices() {
      const data = {};
      for (const asset of portfolio) {
        try {
          const snap = await getMarketSnapshot(asset.id);
          if (snap && snap.price) {
            data[asset.id] = snap;
          } else if (snap && snap.data && snap.data.price) {
            data[asset.id] = snap.data;
          }
        } catch (e) {}
      }
      setMarketData(data);
      setLoading(false);
    }
    
    fetchPrices();
  }, [portfolio]);

  const totalValue = portfolio.reduce((sum, asset) => {
    const price = marketData[asset.id]?.price || 0;
    return sum + (asset.amount * price);
  }, 0);

  const totalChange24h = portfolio.reduce((sum, asset) => {
    const price = marketData[asset.id]?.price || 0;
    const change = marketData[asset.id]?.change_pct_24h || 0;
    // Calculate the dollar value change: value / (1 + change) * change
    const currentValue = asset.amount * price;
    const previousValue = currentValue / (1 + change);
    return sum + (currentValue - previousValue);
  }, 0);

  const changePct = totalValue > 0 ? (totalChange24h / (totalValue - totalChange24h)) * 100 : 0;

  return (
    <div className="fade-in">
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card fade-in stagger-1">
          <div className="card-title">💼 Total Balance</div>
          <div className="card-value" style={{ color: 'var(--accent-blue)' }}>{formatNumber(totalValue)}</div>
          <div className={`card-change ${changePct >= 0 ? 'positive' : 'negative'}`} style={{ marginTop: 8 }}>
            {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% (24h)
          </div>
        </div>
        <div className="card fade-in stagger-2">
          <div className="card-title">📈 24h P&L</div>
          <div className="card-value" style={{ color: totalChange24h >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {totalChange24h >= 0 ? '+' : ''}{formatNumber(totalChange24h)}
          </div>
        </div>
        <div className="card fade-in stagger-3">
          <div className="card-title">🏆 Benchmark vs SSI MAG7</div>
          <div className="card-value" style={{ color: 'var(--text-tertiary)' }}>Alpha: <span style={{color: 'var(--accent-yellow)'}}>+1.2%</span></div>
          <div className="badge badge-cyan" style={{ marginTop: 8 }}>Outperforming</div>
        </div>
      </div>

      <div className="card fade-in stagger-4">
        <div className="card-header">
          <div className="card-title">📋 Asset Allocation</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Amount</th>
              <th>Price</th>
              <th>24h Change</th>
              <th>Value (USD)</th>
              <th>% of Portfolio</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((asset, i) => {
              const price = marketData[asset.id]?.price || 0;
              const change = (marketData[asset.id]?.change_pct_24h || 0) * 100;
              const value = asset.amount * price;
              const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
              
              return (
                <tr key={asset.id} className={`fade-in stagger-${i + 1}`}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{asset.symbol}</td>
                  <td>{asset.amount}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={change >= 0 ? 'positive' : 'negative'}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatNumber(value)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, maxWidth: 80 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-cyan)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {portfolio.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No assets in portfolio.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
