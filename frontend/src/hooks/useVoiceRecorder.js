import { useRef, useState, useCallback } from 'react'

export function useVoiceRecorder({ onAudioReady, silenceMs = 1500 }) {
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)

  const stopRecording = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (recording) return
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    // Voice-activity detection via AudioAnalyser
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    analyserRef.current = analyser

    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mr

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mr.onstop = () => {
      ctx.close()
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size > 0) onAudioReady?.(blob)
    }

    mr.start(100)
    setRecording(true)

    // Silence detection — stop after silenceMs of quiet
    const data = new Uint8Array(analyser.frequencyBinCount)
    function checkSilence() {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      if (avg < 5) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording()
            silenceTimerRef.current = null
          }, silenceMs)
        }
      } else {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(checkSilence)
    }
    rafRef.current = requestAnimationFrame(checkSilence)
  }, [recording, onAudioReady, silenceMs, stopRecording])

  return { recording, startRecording, stopRecording }
}
