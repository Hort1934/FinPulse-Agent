import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSources, subscribeSources, summarize } from '../services/provenance'

const LABEL = {
  live: { text: 'LIVE', cls: 'ds-live', hint: 'All data on this page came from the SoSoValue API just now.' },
  cache: { text: 'LIVE · CACHED', cls: 'ds-live', hint: 'Real SoSoValue data, served from the server cache to respect rate limits.' },
  stale: { text: 'STALE', cls: 'ds-warn', hint: 'SoSoValue failed on refresh; showing the last real copy.' },
  simulated: { text: 'SIMULATED', cls: 'ds-sim', hint: 'Some widgets are showing sample data, not market data.' },
  idle: { text: 'NO DATA YET', cls: 'ds-idle', hint: '' },
}

let cachedList = getSources()
const subscribe = fn => subscribeSources(() => { cachedList = getSources(); fn() })
const getSnapshot = () => cachedList

function ago(ts) {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
}

export default function DataStatus() {
  const list = useSyncExternalStore(subscribe, getSnapshot)
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 15000); return () => clearInterval(id) }, [])

  const { status, counts } = summarize(list)
  const l = LABEL[status]
  const total = list.length

  return (
    <div className="ds-wrap">
      <button className={`ds-badge ${l.cls}`} onClick={() => setOpen(o => !o)} title={l.hint} aria-expanded={open}>
        <span className="ds-dot" />
        {l.text}
        {status === 'simulated' && <span className="ds-count">{counts.simulated}/{total}</span>}
      </button>
      {open && (
        <div className="ds-panel" role="dialog" aria-label="Data sources">
          <div className="ds-panel-title">Data sources on this page</div>
          <div className="ds-panel-hint">{l.hint}</div>
          {list.length === 0 && <div className="ds-row">Nothing loaded yet.</div>}
          {list.map(r => (
            <div key={r.endpoint} className="ds-row">
              <span className={`ds-pill ds-${r.status}`}>{r.status}</span>
              <code>{r.endpoint.split('?')[0]}</code>
              <span className="ds-age">{r.status === 'simulated' ? r.reason : ago(r.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
