export default function TalkButton({ recording, processing, onStart, onStop }) {
  const busy = processing

  if (recording) {
    return (
      <button
        onClick={onStop}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#ef4444',
          color: '#fff', fontSize: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(239,68,68,0.5)',
          transition: 'transform 0.1s',
        }}
        title="Stop recording"
      >
        ■
      </button>
    )
  }

  return (
    <button
      onClick={onStart}
      disabled={busy}
      style={{
        width: 72, height: 72, borderRadius: '50%',
        background: busy ? '#1a1a1a' : '#1d4ed8',
        color: busy ? '#555' : '#fff', fontSize: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: busy ? 0.5 : 1,
        transition: 'background 0.2s, transform 0.1s',
      }}
      title="Talk to avatar"
    >
      🎤
    </button>
  )
}
