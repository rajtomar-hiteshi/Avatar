const STATUS = {
  idle:       { color: '#555',    label: 'Ready' },
  recording:  { color: '#ef4444', label: 'Listening…' },
  processing: { color: '#eab308', label: 'Processing…' },
  speaking:   { color: '#22c55e', label: 'Avatar speaking' },
  error:      { color: '#ef4444', label: 'Error' },
}

export default function StatusBar({ status, error }) {
  const { color, label } = STATUS[status] || STATUS.idle

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: status === 'recording' ? `0 0 6px ${color}` : 'none' }} />
      <span style={{ fontSize: '13px', color: status === 'error' ? '#ef4444' : '#888' }}>
        {status === 'error' && error ? error : label}
      </span>
    </div>
  )
}
