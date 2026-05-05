import VideoCanvas from './VideoCanvas'

const AVATARS = [
  { filename: 'avatar_1.jpg', label: 'Avatar 1' },
  { filename: 'avatar_2.jpg', label: 'Avatar 2' },
]

export default function AvatarPanel({ selectedAvatar, onAvatarChange, videoChunks, isSessionActive }) {
  const previewUrl = `/voice/avatar-preview/${selectedAvatar}`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      {/* Avatar display circle */}
      <div style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '3px solid #22c55e',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Static avatar image */}
        <img
          src={previewUrl}
          alt={selectedAvatar}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none' }}
        />

        {/* Video overlay when chunks arrive */}
        {videoChunks && videoChunks.length > 0 && (
          <VideoCanvas videoChunks={videoChunks} isPlaying={isSessionActive} />
        )}
      </div>

      {/* Avatar selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <label style={{ color: '#888', fontSize: '12px', fontWeight: 600 }}>Avatar:</label>
        <select
          value={selectedAvatar}
          onChange={(e) => onAvatarChange(e.target.value)}
          disabled={isSessionActive}
          style={{
            background: '#1a1a1a',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '13px',
            cursor: isSessionActive ? 'not-allowed' : 'pointer',
            opacity: isSessionActive ? 0.5 : 1,
          }}
        >
          {AVATARS.map((a) => (
            <option key={a.filename} value={a.filename}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {isSessionActive && (
        <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>
          Avatar locked during session
        </p>
      )}
    </div>
  )
}
