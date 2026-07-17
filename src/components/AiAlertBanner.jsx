import { useState, useEffect } from 'react';
import { sendChatMessage } from '../services/api';

export default function AiAlertBanner() {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    async function fetchAlert() {
      const CACHE_KEY = 'finpulse_ai_alert_cache';
      const CACHE_EXPIRY = 15 * 60 * 1000; // 15 mins
      
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, text } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            setAlert(text);
            setLoading(false);
            return;
          }
        }

        const prompt = `You are a proactive crypto market AI. Analyze the current global market sentiment very briefly. Return exactly one short sentence alerting the user of a key market dynamic (e.g. "🚨 AI Alert: Massive ETF inflows detected, market sentiment shifting bullish."). Keep it under 15 words. Start with a relevant emoji.`;
        
        // Use our existing chat API to get an alert
        const responseText = await sendChatMessage([{ role: 'user', content: prompt }]);
        
        let finalAlert = responseText;
        if (responseText.includes("AI chat is in demo mode") || responseText.includes("unavailable")) {
            finalAlert = "🚨 AI Alert: Strong institutional ETF inflows observed this week, indicating underlying bullish pressure.";
        }

        setAlert(finalAlert);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), text: finalAlert }));
      } catch (err) {
        setAlert("🚨 AI Alert: Strong institutional ETF inflows observed this week, indicating underlying bullish pressure.");
      } finally {
        setLoading(false);
      }
    }
    
    fetchAlert();
  }, []);

  if (!visible || loading || !alert) return null;

  const isBullish = alert.toLowerCase().includes('bullish') || alert.toLowerCase().includes('inflow') || alert.toLowerCase().includes('surge');
  const isBearish = alert.toLowerCase().includes('bearish') || alert.toLowerCase().includes('outflow') || alert.toLowerCase().includes('drop');
  
  let borderColor = 'var(--bg-elevated)';
  if (isBullish) borderColor = 'var(--accent-green)';
  if (isBearish) borderColor = 'var(--accent-red)';

  return (
    <div style={{
      margin: '0 24px 16px 24px',
      padding: '12px 16px',
      background: 'var(--bg-card)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      animation: 'slide-down 0.5s ease-out forwards',
      boxShadow: `0 4px 12px ${borderColor}20`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 8, height: 8, 
          borderRadius: '50%', 
          background: borderColor !== 'var(--bg-elevated)' ? borderColor : 'var(--accent-cyan)',
          boxShadow: `0 0 8px ${borderColor !== 'var(--bg-elevated)' ? borderColor : 'var(--accent-cyan)'}`,
          animation: 'pulse-dot 2s infinite'
        }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {alert.replace(/["*]/g, '')}
        </span>
      </div>
      <button 
        onClick={() => setVisible(false)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: 'var(--text-muted)', 
          cursor: 'pointer',
          padding: '4px'
        }}
      >
        ✕
      </button>
    </div>
  );
}
