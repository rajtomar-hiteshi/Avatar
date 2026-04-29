import { useState } from 'react'

function latencyColor(totalMs) {
  if (totalMs < 2000) return '#22c55e'
  if (totalMs < 4000) return '#eab308'
  return '#ef4444'
}

function latencyLabel(totalMs) {
  if (totalMs < 2000) return 'Fast'
  if (totalMs < 4000) return 'Normal'
  return 'Slow'
}

export default function DebugPanel({ debugInfo, latencyInfo }) {
  const [open, setOpen] = useState(false)
  const { transcript, reply, audioBlobSize, error } = debugInfo

  return (
    <div style={{ width: '100%', maxWidth: '600px' }}>

      {/* Latency badge — always visible after first response */}
      {latencyInfo && (
        <div style={{
          marginBottom: '8px',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>⚡ Last response:</span>
          <span style={{ color: '#aaa' }}>{latencyInfo.apiRoundTrip}ms API</span>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: latencyColor(latencyInfo.totalFromSpeech), fontWeight: 600 }}>
            {latencyInfo.totalFromSpeech}ms total
          </span>
          <span style={{
            fontSize: '10px',
            color: latencyColor(latencyInfo.totalFromSpeech),
            border: `1px solid ${latencyColor(latencyInfo.totalFromSpeech)}`,
            borderRadius: '3px',
            padding: '1px 5px',
          }}>
            {latencyLabel(latencyInfo.totalFromSpeech)}
          </span>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: '1px solid #333',
          color: '#666',
          padding: '4px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        {open ? 'Hide Debug' : 'Show Debug'}
      </button>

      {open && (
        <div style={{
          marginTop: '8px',
          background: '#111',
          border: '1px solid #222',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          color: '#aaa',
          lineHeight: '1.6',
        }}>
          <div><strong style={{ color: '#fff' }}>X-Transcript:</strong> {transcript || '—'}</div>
          <div><strong style={{ color: '#fff' }}>X-Reply:</strong> {reply || '—'}</div>
          <div><strong style={{ color: '#fff' }}>Audio blob size:</strong> {audioBlobSize != null ? `${audioBlobSize} bytes` : '—'}</div>

          {latencyInfo && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #222', paddingTop: '8px' }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>Latency breakdown</div>
              <div>API round-trip (STT + LLM + TTS): <span style={{ color: '#fff' }}>{latencyInfo.apiRoundTrip}ms</span></div>
              <div>Audio playback duration: <span style={{ color: '#fff' }}>{latencyInfo.audioPlayback}ms</span></div>
              <div>
                Total end-to-end:{' '}
                <span style={{ color: latencyColor(latencyInfo.totalFromSpeech), fontWeight: 600 }}>
                  {latencyInfo.totalFromSpeech}ms — {latencyLabel(latencyInfo.totalFromSpeech)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ color: '#f87171', marginTop: '6px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
