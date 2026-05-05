import { useState, useEffect, useCallback, useRef } from 'react'
import AvatarWebRTC from './components/AvatarWebRTC'
import ConversationLog from './components/ConversationLog'
import StatusBar from './components/StatusBar'
import TalkButton from './components/TalkButton'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { processAudio, getAvatarConfig, setRunpodUrl } from './api/voiceApi'

export default function App() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [runpodUrl, setRunpodUrlState] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [avatarStatus, setAvatarStatus] = useState('disconnected')
  const [avatarActive, setAvatarActive] = useState(false)
  const processingRef = useRef(false)

  // Load saved RunPod URL from backend on mount
  useEffect(() => {
    getAvatarConfig().then(({ runpod_url }) => {
      if (runpod_url) {
        setRunpodUrlState(runpod_url)
        setUrlInput(runpod_url)
        setAvatarActive(true)
      }
    })
  }, [])

  const handleSetUrl = useCallback(async () => {
    const url = urlInput.trim()
    if (!url) return
    await setRunpodUrl(url)
    setRunpodUrlState(url)
    setAvatarActive(true)
  }, [urlInput])

  const handleAudioReady = useCallback(async (blob) => {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('processing')
    setError('')

    let agentMsgIdx = null

    try {
      await processAudio(blob, {
        onTranscript(text) {
          setMessages((prev) => [...prev, { role: 'user', text }])
        },
        onReply(text) {
          setMessages((prev) => {
            agentMsgIdx = prev.length
            return [...prev, { role: 'agent', text }]
          })
        },
        onAvatarSent() {
          setStatus('speaking')
        },
        onDone() {
          // If avatar didn't speak (no RunPod URL), go back to idle
          if (status !== 'speaking') setStatus('idle')
          // After a reasonable time, reset to idle
          setTimeout(() => setStatus('idle'), 3000)
        },
        onError(err) {
          setError(err.message)
          setStatus('error')
        },
      })
    } catch {
      // already handled
    } finally {
      processingRef.current = false
      if (status !== 'speaking') setStatus('idle')
    }
  }, [status])

  const { recording, startRecording, stopRecording } = useVoiceRecorder({
    onAudioReady: handleAudioReady,
  })

  useEffect(() => {
    if (recording) setStatus('recording')
    else if (status === 'recording') setStatus('idle')
  }, [recording])

  // Avatar done speaking — back to idle (estimated via status)
  useEffect(() => {
    if (avatarStatus === 'connected' && status === 'speaking') {
      // No explicit "done" event from WebRTC; rely on onDone timeout above
    }
  }, [avatarStatus, status])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#e5e5e5', letterSpacing: '-0.01em' }}>
        Avatar Voice Agent
      </h1>

      {/* Avatar video */}
      <AvatarWebRTC
        runpodUrl={runpodUrl}
        active={avatarActive}
        onStatusChange={setAvatarStatus}
      />

      {/* RunPod URL config */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSetUrl()}
          placeholder="https://your-runpod-url:8010"
          style={{
            flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
            color: '#ccc', padding: '8px 12px', fontSize: '13px', outline: 'none',
          }}
        />
        <button
          onClick={handleSetUrl}
          style={{
            background: '#1d4ed8', color: '#fff', borderRadius: '8px',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600,
          }}
        >
          Connect
        </button>
        {avatarActive && (
          <button
            onClick={() => { setAvatarActive(false); setRunpodUrlState('') }}
            style={{
              background: '#1a1a1a', color: '#888', borderRadius: '8px',
              padding: '8px 12px', fontSize: '13px', border: '1px solid #2a2a2a',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: avatarStatus === 'connected' ? '#22c55e' : avatarStatus === 'connecting' ? '#eab308' : '#444',
        }} />
        <span style={{ color: '#555' }}>
          Avatar: {avatarStatus}
        </span>
      </div>

      <StatusBar status={status} error={error} />

      <ConversationLog messages={messages} />

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
        <TalkButton
          recording={recording}
          processing={status === 'processing'}
          onStart={startRecording}
          onStop={stopRecording}
        />
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#333' }}>
        {recording ? 'Speak now — stops automatically on silence' : 'Tap the mic to speak'}
      </p>
    </div>
  )
}
