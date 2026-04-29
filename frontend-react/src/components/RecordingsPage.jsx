import { useState, useEffect } from 'react'

export default function RecordingsPage({ onBack }) {
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRecordings()
  }, [])

  async function fetchRecordings() {
    setLoading(true)
    try {
      const res = await fetch('/recordings/list')
      const data = await res.json()
      setRecordings(data.recordings || [])
    } catch (err) {
      setError('Failed to load recordings')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(filename) {
    try {
      await fetch(`/recordings/delete/${filename}`, { method: 'DELETE' })
      setRecordings((prev) => prev.filter((r) => r.filename !== filename))
    } catch {
      setError('Failed to delete recording')
    }
  }

  function formatName(filename) {
    const match = filename.match(/session_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/)
    if (match) return `Session — ${match[1]} ${match[2].replace(/-/g, ':')}`
    return filename
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      color: '#fff',
      padding: '24px 16px',
      fontFamily: 'inherit',
    }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={onBack}
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              color: '#aaa',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Session Recordings</h1>
          <button
            onClick={fetchRecordings}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid #333',
              color: '#666',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#f87171', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '60px' }}>Loading recordings...</div>
        )}

        {/* Empty state */}
        {!loading && recordings.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#444',
            marginTop: '80px',
            fontSize: '15px',
            lineHeight: '1.8',
          }}>
            No recordings yet.<br />
            Start a conversation to create one.
          </div>
        )}

        {/* Recording cards */}
        {recordings.map((rec) => (
          <div key={rec.filename} style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid #222',
          }}>
            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  {formatName(rec.filename)}
                </div>
                <div style={{ color: '#555', fontSize: '12px' }}>
                  {rec.size_mb} MB &nbsp;·&nbsp; {rec.created_at}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={rec.url}
                  download={rec.filename}
                  style={{
                    background: '#2d2d2d',
                    border: '1px solid #333',
                    color: '#aaa',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'none',
                  }}
                >
                  Download
                </a>
                <button
                  onClick={() => handleDelete(rec.filename)}
                  style={{
                    background: 'none',
                    border: '1px solid #3f1a1a',
                    color: '#f87171',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Video player */}
            <video
              src={rec.url}
              controls
              style={{ width: '100%', borderRadius: '8px', background: '#000', display: 'block' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
