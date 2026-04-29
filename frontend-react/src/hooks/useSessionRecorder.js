import { useState, useRef } from 'react'

export function useSessionRecorder() {
  const [isRecording, setIsRecording] = useState(false)

  const screenStreamRef = useRef(null)
  const micStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true,
      })

      let micStream
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        throw new Error('Microphone permission denied')
      }

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...screenStream.getAudioTracks(),
        ...micStream.getAudioTracks(),
      ])

      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'

      const recorder = new MediaRecorder(combinedStream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // Stop recording automatically if user stops screen share via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }

      recorder.start(1000)

      screenStreamRef.current = screenStream
      micStreamRef.current = micStream
      mediaRecorderRef.current = recorder

      setIsRecording(true)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.message.includes('denied')) {
        throw new Error('Screen recording permission denied')
      }
      throw err
    }
  }

  function stopRecording() {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        screenStreamRef.current?.getTracks().forEach((t) => t.stop())
        micStreamRef.current?.getTracks().forEach((t) => t.stop())

        screenStreamRef.current = null
        micStreamRef.current = null
        mediaRecorderRef.current = null
        chunksRef.current = []

        setIsRecording(false)
        resolve(blob)
      }

      recorder.stop()
    })
  }

  async function uploadRecording(blob) {
    try {
      const formData = new FormData()
      formData.append('file', blob, 'session.webm')

      const response = await fetch('/recordings/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        console.log(`Recording uploaded: ${data.filename} (${data.size_mb} MB)`)
      } else {
        console.error('Recording upload failed:', data.error)
      }
      return data
    } catch (err) {
      console.error('Recording upload error:', err)
      return null
    }
  }

  return { isRecording, startRecording, stopRecording, uploadRecording }
}
