import { useState, useRef, useEffect } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://13.126.7.165'

export default function AvatarPanel({ isSessionActive, videoChunk }) {
  const [avatarReady, setAvatarReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('Upload your photo to start')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Show preview
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setStatus('Preparing avatar... (30-60 sec)')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch(`${BACKEND_URL}/avatar/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await resp.json()
      if (data.status === 'ready') {
        setAvatarReady(true)
        setStatus('Avatar ready! Start conversation.')
      } else {
        setStatus('Upload failed. Try again.')
      }
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      background: '#111',
      borderRadius: '16px',
      minWidth: '260px'
    }}>
      <div style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: avatarReady ? '3px solid #22c55e' : '3px solid #333',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative'
      }} onClick={() => !avatarReady && fileInputRef.current?.click()}>
        {preview ? (
          <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          null
        )}
        {videoChunk && (
          <video
            key={videoChunk}
            autoPlay
            playsInline
            muted
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
            src={`data:video/mp4;base64,${videoChunk}`}
          />
        )}
        {!preview && (
          <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            Click to upload your photo
          </div>
        )}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '12px'
          }}>Preparing...</div>
        )}
      </div>

      <p style={{
        color: avatarReady ? '#22c55e' : '#888',
        fontSize: '12px', margin: 0, textAlign: 'center'
      }}>{status}</p>

      {!avatarReady && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '8px 20px', cursor: 'pointer',
            fontSize: '13px', opacity: uploading ? 0.5 : 1
          }}>
          {uploading ? 'Preparing...' : 'Upload Photo'}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
