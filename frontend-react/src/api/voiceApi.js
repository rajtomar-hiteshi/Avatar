export async function sendAudioToBackend(blob, callbacks = {}, playAudioFn) {
  const { onTranscript, onTextChunk, onAudioChunk, onDone, onPlaybackComplete, onError } = callbacks

  const formData = new FormData()
  formData.append('audio', blob, 'recording.webm')

  const response = await fetch('/voice/process', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`HTTP ${response.status}: ${errorText}`)
    onError?.(err)
    throw err
  }

  const audioQueue = []
  let isPlaying = false
  let isDone = false

  async function playNextChunk() {
    if (isPlaying || audioQueue.length === 0) {
      if (isDone && audioQueue.length === 0 && !isPlaying) {
        onPlaybackComplete?.()
      }
      return
    }

    isPlaying = true
    const audioBlob = audioQueue.shift()

    onAudioChunk?.()

    try {
      if (typeof playAudioFn === 'function') {
        await playAudioFn(audioBlob)
      } else {
        const url = URL.createObjectURL(audioBlob)
        await new Promise((resolve) => {
          const audio = new Audio(url)
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
          audio.play().catch(() => resolve())
        })
      }
    } catch (err) {
      console.error("playNextChunk error:", err)
    }

    isPlaying = false
    playNextChunk()
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)

      if (payload.startsWith('TRANSCRIPT:')) {
        onTranscript?.(payload.slice(11))

      } else if (payload.startsWith('TEXT:')) {
        onTextChunk?.(payload.slice(5))

      } else if (payload.startsWith('AUDIO:')) {
        const b64 = payload.slice(6)
        const audioBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        audioQueue.push(new Blob([audioBytes], { type: 'audio/mpeg' }))
        playNextChunk()

      } else if (payload.startsWith('DONE:')) {
        const fullReply = payload.slice(5)
        isDone = true
        onDone?.(fullReply)
        playNextChunk()

      } else if (payload.startsWith('ERROR:')) {
        const err = new Error(payload.slice(6))
        onError?.(err)
        throw err
      }
    }
  }
}
