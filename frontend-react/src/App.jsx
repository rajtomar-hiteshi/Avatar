import { useState, useRef, useCallback } from 'react'
import { sendAudioToBackend } from './api/voiceApi'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useSessionRecorder } from './hooks/useSessionRecorder'
import { useLiveKit } from './hooks/useLiveKit'
import TalkButton from './components/TalkButton'
import StatusBar from './components/StatusBar'
import ConversationLog from './components/ConversationLog'
import DebugPanel from './components/DebugPanel'
import RecordingsPage from './components/RecordingsPage'

export default function App() {
  const [agentState, setAgentState] = useState('idle')
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [messages, setMessages] = useState([])
  const [debugInfo, setDebugInfo] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [latencyInfo, setLatencyInfo] = useState(null)
  const [currentPage, setCurrentPage] = useState('agent')
  const [recordingStatus, setRecordingStatus] = useState('idle')
  const [saveMessage, setSaveMessage] = useState('')

  const agentStateRef = useRef('idle')

  const { isRecording, recordingStatus: sessionRecordingStatus, startRecording, stopRecording, uploadRecording, playAgentAudio } = useSessionRecorder()
  const { lkStatus, lkError, connectLiveKit, disconnectLiveKit } = useLiveKit()

  function updateAgentState(state) {
    agentStateRef.current = state
    setAgentState(state)
  }

  function addMessage(msg) {
    setMessages((prev) => [...prev, msg])
  }

  const onAudioReady = useCallback(async (blob) => {
    if (agentStateRef.current !== 'idle') return

    const t0 = performance.now()
    const tSendStart = performance.now()
    let transcriptText = ''
    let agentMessageAdded = false

    try {
      updateAgentState('processing')

      await sendAudioToBackend(blob, {
        onTranscript(transcript) {
          transcriptText = transcript
          setMessages((prev) => [...prev, { role: 'user', text: transcript }])
        },

        onTextChunk(chunk) {
          if (!agentMessageAdded) {
            agentMessageAdded = true
            setMessages((prev) => [...prev, { role: 'agent', text: chunk }])
          } else {
            setMessages((prev) => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (updated[lastIdx]?.role === 'agent') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  text: updated[lastIdx].text + chunk,
                }
              }
              return updated
            })
          }
        },

        onAudioChunk() {
          if (agentStateRef.current !== 'speaking') {
            updateAgentState('speaking')
          }
        },

        onDone(fullReply) {
          const tDone = performance.now()
          setDebugInfo({ transcript: transcriptText, reply: fullReply, audioBlobSize: null })
          setLatencyInfo({
            apiRoundTrip: Math.round(tDone - tSendStart),
            audioPlayback: 0,
            totalFromSpeech: Math.round(tDone - t0),
          })
        },

        onPlaybackComplete() {
          updateAgentState('idle')
          setErrorMessage('')
          agentMessageAdded = false
        },

        onError(err) {
          updateAgentState('idle')
          setErrorMessage(err.message)
          setDebugInfo((prev) => ({ ...prev, error: err.message }))
        },
      }, playAgentAudio)
    } catch (err) {
      updateAgentState('idle')
      setErrorMessage(err.message)
      setDebugInfo((prev) => ({ ...prev, error: err.message }))
    }
  }, [])

  const { sessionState, volumeLevel, startSession, stopSession, setSensitivity } =
    useVoiceRecorder({ onAudioReady })

  function getDisplayStatus() {
    if (!isSessionActive) return errorMessage ? 'error' : 'idle'
    if (agentState === 'processing') return 'processing'
    if (agentState === 'speaking') return 'speaking'
    if (sessionState === 'speaking') return 'recording'
    return 'listening'
  }

  const displayStatus = getDisplayStatus()

  const handleStart = useCallback(async () => {
    setErrorMessage('')
    setSaveMessage('')
    try {
      setIsSessionActive(true)
      await startSession()
    } catch (err) {
      setIsSessionActive(false)
      setErrorMessage(err.message)
      return
    }

    // Start screen recording — non-blocking, failure doesn't stop conversation
    try {
      await startRecording()
      setRecordingStatus('recording')
    } catch (err) {
      console.warn('Screen recording not started:', err.message)
      // Don't show error to user — recording is optional
    }
  }, [startSession, startRecording])

  const handleStop = useCallback(async () => {
    stopSession()
    setIsSessionActive(false)
    updateAgentState('idle')

    // Stop and upload recording if one was active
    if (isRecording) {
      try {
        setRecordingStatus('uploading')
        const blob = await stopRecording()
        if (blob && blob.size > 0) {
          await uploadRecording(blob)
          setSaveMessage('Session saved to recordings')
          setTimeout(() => setSaveMessage(''), 4000)
        }
      } catch (err) {
        console.error('Recording stop/upload failed:', err)
      } finally {
        setRecordingStatus('idle')
      }
    }
  }, [stopSession, isRecording, stopRecording, uploadRecording])

  if (currentPage === 'recordings') {
    return <RecordingsPage onBack={() => setCurrentPage('agent')} />
  }

  return (
    <div className="app" style={{ position: 'relative' }}>

      {/* REC indicator */}
      {recordingStatus === 'recording' && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#ef4444',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ef4444',
            animation: 'recordingPulse 0.8s ease-in-out infinite',
            display: 'inline-block',
          }} />
          REC
        </div>
      )}

      {/* Uploading indicator */}
      {recordingStatus === 'uploading' && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          fontSize: '12px',
          color: '#eab308',
        }}>
          Saving recording...
        </div>
      )}

      {/* Save confirmation */}
      {saveMessage && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          fontSize: '12px',
          color: '#22c55e',
        }}>
          ✓ {saveMessage}
        </div>
      )}

      {/* Recordings button */}
      <button
        onClick={() => setCurrentPage('recordings')}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: '#1a1a1a',
          border: '1px solid #333',
          color: '#aaa',
          padding: '6px 14px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Recordings
      </button>

      {/* ── LiveKit panel ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', justifyContent: 'center' }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: lkStatus === 'connected' ? '#22c55e' : lkStatus === 'connecting' ? '#eab308' : lkStatus === 'error' ? '#ef4444' : '#888',
        }}>
          LiveKit: {lkStatus}
        </span>
        {lkStatus === 'disconnected' || lkStatus === 'error' ? (
          <button
            onClick={() => connectLiveKit()}
            style={{
              background: '#1a1a1a', border: '1px solid #444', color: '#ccc',
              padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Connect
          </button>
        ) : (
          <button
            onClick={disconnectLiveKit}
            style={{
              background: '#1a1a1a', border: '1px solid #444', color: '#ccc',
              padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Disconnect
          </button>
        )}
        {lkError && <span style={{ fontSize: '11px', color: '#ef4444' }}>{lkError}</span>}
      </div>

      <h1 className="app-title">Voice Agent</h1>
      <StatusBar status={displayStatus} errorMessage={errorMessage} />
      <ConversationLog messages={messages} isTyping={agentState === 'processing'} />
      <TalkButton
        isSessionActive={isSessionActive}
        onStart={handleStart}
        onStop={handleStop}
        displayStatus={displayStatus}
        volumeLevel={volumeLevel}
        sessionState={sessionState}
        onSensitivityChange={setSensitivity}
      />
      <DebugPanel debugInfo={debugInfo} latencyInfo={latencyInfo} />
    </div>
  )
}
