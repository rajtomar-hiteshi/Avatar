import { useRef, useState, useCallback } from 'react'

const SILENCE_THRESHOLD = 5
const SPEECH_THRESHOLD = 8
const SILENCE_DURATION_MS = 1500
const MIN_SPEECH_DURATION_MS = 400
const POLL_INTERVAL_MS = 80
const VOLUME_HISTORY_SIZE = 4
const DEFAULT_GAIN = 4.0

export function useVoiceRecorder({ onAudioReady }) {
  const [sessionState, setSessionState] = useState('idle')
  const [volumeLevel, setVolumeLevel] = useState(0)

  const r = useRef({
    audioContext: null,
    analyser: null,
    gainNode: null,
    mediaRecorder: null,
    stream: null,
    chunks: [],
    state: 'idle',
    silenceStart: null,
    speechStart: null,
    timer: null,
    volumeHistory: [],
  })

  const onAudioReadyRef = useRef(onAudioReady)
  onAudioReadyRef.current = onAudioReady

  const applyState = (state) => {
    r.current.state = state
    setSessionState(state)
  }

  const getRMS = () => {
    const analyser = r.current.analyser
    if (!analyser) return 0
    const buf = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / buf.length) * 100
  }

  const getAvgVolume = (rms) => {
    r.current.volumeHistory.push(rms)
    if (r.current.volumeHistory.length > VOLUME_HISTORY_SIZE) {
      r.current.volumeHistory.shift()
    }
    const history = r.current.volumeHistory
    return history.reduce((a, b) => a + b, 0) / history.length
  }

  const pollRef = useRef(null)
  const finishRef = useRef(null)

  finishRef.current = () => {
    if (r.current.state === 'idle') return

    const recorder = r.current.mediaRecorder
    const speechDuration = Date.now() - r.current.speechStart

    if (!recorder || recorder.state === 'inactive') {
      applyState('listening')
      r.current.timer = setTimeout(() => pollRef.current?.(), POLL_INTERVAL_MS)
      return
    }

    applyState('processing')

    recorder.onstop = () => {
      if (r.current.state === 'idle') return

      if (speechDuration >= MIN_SPEECH_DURATION_MS) {
        const blob = new Blob(r.current.chunks, { type: 'audio/webm;codecs=opus' })
        onAudioReadyRef.current(blob)
      }

      r.current.chunks = []
      r.current.mediaRecorder = null
      r.current.silenceStart = null

      if (r.current.state !== 'idle') {
        applyState('listening')
        r.current.timer = setTimeout(() => pollRef.current?.(), POLL_INTERVAL_MS)
      }
    }

    recorder.stop()
  }

  pollRef.current = () => {
    const state = r.current.state
    if (state === 'idle' || state === 'processing') return

    const rms = getRMS()
    const avgVolume = getAvgVolume(rms)

    setVolumeLevel(Math.min(100, (avgVolume / 30) * 100))

    const now = Date.now()

    if (state === 'listening') {
      if (avgVolume > SPEECH_THRESHOLD) {
        r.current.chunks = []
        // MediaRecorder records from the raw stream — NOT through the gainNode
        const recorder = new MediaRecorder(r.current.stream, {
          mimeType: 'audio/webm;codecs=opus',
        })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) r.current.chunks.push(e.data)
        }
        recorder.start()
        r.current.mediaRecorder = recorder
        r.current.speechStart = now
        r.current.silenceStart = null
        applyState('speaking')
      }
    } else if (state === 'speaking') {
      if (avgVolume < SILENCE_THRESHOLD) {
        if (r.current.silenceStart === null) {
          r.current.silenceStart = now
        } else if (now - r.current.silenceStart >= SILENCE_DURATION_MS) {
          finishRef.current()
          return
        }
      } else {
        r.current.silenceStart = null
      }
    }

    r.current.timer = setTimeout(() => pollRef.current?.(), POLL_INTERVAL_MS)
  }

  const startSession = useCallback(async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new Error('Microphone access denied — please allow mic permission')
    }

    r.current.stream = stream
    r.current.volumeHistory = []

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioContext.createMediaStreamSource(stream)
    const gainNode = audioContext.createGain()
    gainNode.gain.value = DEFAULT_GAIN
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512

    // Chain: mic → gainNode → analyser (VAD only — recording is from raw stream)
    source.connect(gainNode)
    gainNode.connect(analyser)

    r.current.audioContext = audioContext
    r.current.gainNode = gainNode
    r.current.analyser = analyser

    applyState('listening')
    r.current.timer = setTimeout(() => pollRef.current?.(), POLL_INTERVAL_MS)
  }, [])

  const stopSession = useCallback(() => {
    clearTimeout(r.current.timer)

    if (r.current.mediaRecorder) {
      r.current.mediaRecorder.onstop = null
      if (r.current.mediaRecorder.state !== 'inactive') {
        r.current.mediaRecorder.stop()
      }
      r.current.mediaRecorder = null
    }

    if (r.current.gainNode) {
      r.current.gainNode.disconnect()
      r.current.gainNode = null
    }

    if (r.current.stream) {
      r.current.stream.getTracks().forEach((t) => t.stop())
      r.current.stream = null
    }

    if (r.current.audioContext) {
      r.current.audioContext.close()
      r.current.audioContext = null
    }

    r.current.analyser = null
    r.current.chunks = []
    r.current.silenceStart = null
    r.current.speechStart = null
    r.current.volumeHistory = []

    applyState('idle')
    setVolumeLevel(0)
  }, [])

  // Adjust mic amplification live without restarting the session
  const setSensitivity = useCallback((value) => {
    if (r.current.gainNode) {
      r.current.gainNode.gain.value = Number(value)
    }
  }, [])

  return { sessionState, volumeLevel, startSession, stopSession, setSensitivity }
}
