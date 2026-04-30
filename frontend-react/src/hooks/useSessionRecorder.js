import { useRef, useState, useCallback } from "react"

export function useSessionRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState("idle")

  const audioCtxRef = useRef(null)
  const destinationRef = useRef(null)
  const screenStreamRef = useRef(null)
  const micStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = []

      const ctx = new AudioContext({ sampleRate: 44100 })
      audioCtxRef.current = ctx
      const destination = ctx.createMediaStreamDestination()
      destinationRef.current = destination

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })
      screenStreamRef.current = screenStream

      screenStream.getVideoTracks()[0].onended = () => {
        console.log("Screen share ended by user")
        stopRecording()
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      micStreamRef.current = micStream

      const micSource = ctx.createMediaStreamSource(micStream)
      const micGain = ctx.createGain()
      micGain.gain.value = 1.0
      micSource.connect(micGain)
      micGain.connect(destination)

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ])

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm'

      console.log("Recording mimeType:", mimeType)

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      })

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e)
      }

      recorder.start(1000)
      recorderRef.current = recorder

      setIsRecording(true)
      setRecordingStatus("recording")
      console.log("Recording started: screen + mic + agent audio")

    } catch (err) {
      console.error("startRecording failed:", err)
      setIsRecording(false)
      setRecordingStatus("error")
    }
  }, [])

  const playAgentAudio = useCallback(async (audioBlob) => {
    return new Promise(async (resolve) => {
      try {
        const arrayBuffer = await audioBlob.arrayBuffer()

        if (audioCtxRef.current && destinationRef.current &&
            audioCtxRef.current.state !== 'closed') {

          const ctx = audioCtxRef.current

          if (ctx.state === 'suspended') {
            await ctx.resume()
          }

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

          const source = ctx.createBufferSource()
          source.buffer = audioBuffer

          const agentGain = ctx.createGain()
          agentGain.gain.value = 1.0

          source.connect(agentGain)
          agentGain.connect(destinationRef.current)
          agentGain.connect(ctx.destination)

          source.onended = () => resolve()
          source.start(0)

        } else {
          console.warn("AudioContext not available, falling back to Audio element")
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
          audio.play().catch(() => resolve())
        }
      } catch (err) {
        console.error("playAgentAudio error:", err)
        resolve()
      }
    })
  }, [])

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!recorderRef.current ||
          recorderRef.current.state === 'inactive') {
        cleanup()
        resolve(null)
        return
      }

      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        console.log(`Recording stopped: ${blob.size} bytes, ${chunksRef.current.length} chunks`)
        cleanup()
        resolve(blob)
      }

      recorderRef.current.stop()
    })
  }, [])

  function cleanup() {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
    }

    audioCtxRef.current = null
    destinationRef.current = null
    screenStreamRef.current = null
    micStreamRef.current = null
    recorderRef.current = null
    chunksRef.current = []

    setIsRecording(false)
    setRecordingStatus("idle")
  }

  const uploadRecording = useCallback(async (blob) => {
    if (!blob || blob.size === 0) {
      console.warn("Empty blob, skipping upload")
      return null
    }

    setRecordingStatus("uploading")
    try {
      const formData = new FormData()
      formData.append("file", blob, "session.webm")

      const res = await fetch("/recordings/upload", {
        method: "POST",
        body: formData
      })

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

      const data = await res.json()
      console.log("Upload successful:", data)
      setRecordingStatus("done")
      return data

    } catch (err) {
      console.error("Upload failed:", err)
      setRecordingStatus("error")
      return null
    }
  }, [])

  return {
    isRecording,
    recordingStatus,
    startRecording,
    stopRecording,
    uploadRecording,
    playAgentAudio
  }
}
