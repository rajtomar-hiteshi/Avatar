export async function processAudio(blob, callbacks = {}) {
  const { onTranscript, onReply, onAvatarSent, onDone, onError } = callbacks

  const formData = new FormData()
  formData.append('audio', blob, 'recording.webm')

  const response = await fetch('/voice/process', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    const err = new Error(`HTTP ${response.status}: ${text}`)
    onError?.(err)
    throw err
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
      } else if (payload.startsWith('REPLY:')) {
        onReply?.(payload.slice(6))
      } else if (payload === 'AVATAR_SENT') {
        onAvatarSent?.()
      } else if (payload.startsWith('DONE:')) {
        onDone?.(payload.slice(5))
      } else if (payload.startsWith('ERROR:')) {
        const err = new Error(payload.slice(6))
        onError?.(err)
        throw err
      }
    }
  }
}

export async function getAvatarConfig() {
  const res = await fetch('/avatar/config')
  if (!res.ok) return { runpod_url: '' }
  return res.json()
}

export async function setRunpodUrl(url) {
  const res = await fetch(`/admin/set-pod-url?url=${encodeURIComponent(url)}`)
  return res.json()
}
