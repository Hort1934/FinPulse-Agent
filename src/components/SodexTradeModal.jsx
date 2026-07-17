import { useState } from 'react';

export default function SodexTradeModal({ isOpen, onClose, asset }) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle, confirming, executing, success, error
  const [txHash, setTxHash] = useState('');

  if (!isOpen) return null;

  const handleTrade = async () => {
    setStatus('confirming');
    
    // Simulate risk/user confirmation pause
    await new Promise(r => setTimeout(r, 1000));
    setStatus('executing');

    // Simulate execution delay (mocking testnet API call)
    await new Promise(r => setTimeout(r, 2000));
    
    // Simulate success
    setStatus('success');
    setTxHash(`0x${Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')}`);
  };

  const resetAndClose = () => {
    setStatus('idle');
    setAmount('');
    setTxHash('');
    onClose();
  };

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-content">
        <div className="modal-header">
          <h3>⚡ SoDEX Execution</h3>
          <button onClick={resetAndClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body">
          {status === 'idle' && (
            <>
              <div className="trade-info-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Asset</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold' }}>{asset?.name} ({asset?.symbol})</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current Price</div>
                    <div style={{ fontFamily: 'var(--font-mono)' }}>${asset?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>

              <div className="trade-input-group">
                <label>Amount (USD)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">$</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                {amount && asset?.price && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
                    ≈ {(parseFloat(amount) / asset.price).toFixed(6)} {asset?.symbol}
                  </div>
                )}
              </div>

              <div className="risk-warning-box">
                <div className="risk-header">⚠️ Risk Warning</div>
                <div className="risk-body">
                  <p>On-chain execution is subject to slippage and MEV. Your transaction will be routed via <strong>ValueChain</strong> for optimal execution.</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span>Max Slippage:</span>
                    <span style={{ color: 'var(--accent-red)' }}>0.5%</span>
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-full" 
                onClick={handleTrade}
                disabled={!amount || isNaN(amount) || parseFloat(amount) <= 0}
              >
                Confirm Trade
              </button>
            </>
          )}

          {status === 'confirming' && (
            <div className="status-container">
              <div className="spinner"></div>
              <h3>Confirming details...</h3>
              <p style={{ color: 'var(--text-muted)' }}>Checking liquidity and slippage tolerance</p>
            </div>
          )}

          {status === 'executing' && (
            <div className="status-container">
              <div className="spinner valuechain-spinner"></div>
              <h3>Executing on ValueChain...</h3>
              <p style={{ color: 'var(--text-muted)' }}>Routing order via SoDEX</p>
            </div>
          )}

          {status === 'success' && (
            <div className="status-container success-state">
              <div className="success-icon">✅</div>
              <h3>Trade Executed!</h3>
              <div className="tx-box">
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Transaction Hash:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all', marginTop: 4, color: 'var(--accent-blue)' }}>
                  {txHash}
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={resetAndClose} style={{ marginTop: 24 }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
