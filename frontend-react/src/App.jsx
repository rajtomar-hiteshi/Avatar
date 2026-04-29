import { useState, useRef, useCallback } from 'react'
import { sendAudioToBackend } from './api/voiceApi'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import TalkButton from './components/TalkButton'
import StatusBar from './components/StatusBar'
import ConversationLog from './components/ConversationLog'
import DebugPanel from './components/DebugPanel'

export default function App() {
  const [agentState, setAgentState] = useState('idle')
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [messages, setMessages] = useState([])
  const [debugInfo, setDebugInfo] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [latencyInfo, setLatencyInfo] = useState(null)

  const agentStateRef = useRef('idle')

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
          // Always add user message first
          transcriptText = transcript
          setMessages((prev) => [...prev, { role: 'user', text: transcript }])
        },

        onTextChunk(chunk) {
          if (!agentMessageAdded) {
            // First chunk: append a new agent message after the user message
            agentMessageAdded = true
            setMessages((prev) => [...prev, { role: 'agent', text: chunk }])
          } else {
            // Subsequent chunks: append to the last message (always agent at this point)
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
      })
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
    try {
      setIsSessionActive(true)
      await startSession()
    } catch (err) {
      setIsSessionActive(false)
      setErrorMessage(err.message)
    }
  }, [startSession])

  const handleStop = useCallback(() => {
    stopSession()
    setIsSessionActive(false)
    updateAgentState('idle')
  }, [stopSession])

  return (
    <div className="app">
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
